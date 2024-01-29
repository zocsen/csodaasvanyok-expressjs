const { Order } = require('../models/order');
const express = require('express');
const { OrderItem } = require('../models/order-item');
const { Product } = require('../models/product');
const router = express.Router();
require('dotenv/config');
const mongoose = require('mongoose');

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = require('stripe')(stripeSecretKey);

const nodemailer = require('nodemailer');

const SITE_URL = process.env.SITE_URL;

async function sendOrderConfirmationEmail(orderId, userEmail, orderItems) {
    let transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: 'csodaasvanyok@gmail.com',
            pass: `${process.env.EMAIL_PASSWORD}`
        }
    });

    let itemsDescription = orderItems
        .map(
            (item) =>
                `<p><strong>Termék neve:</strong> ${item.product.name}</p>
                <p><strong>Mennyiség:</strong> ${item.quantity}</p>
                <p><strong>Méret:</strong> ${item.size}</p>`
        )
        .join('<br>');

    let customerMailOptions = {
        from: 'csodaasvanyok@gmail.com',
        to: userEmail,
        subject: 'Csodaásványok Rendelés Visszaigazolása',
        html: `Tisztelt Vásárlónk!

<p>Szeretnénk megköszönni, hogy a Csodaásványok webáruházat választotta. Örömmel értesítjük, hogy rendelését sikeresen rögzítettük, és az jelenleg feldolgozás alatt áll. Amennyiben a FoxPost Csomagautomatát választotta kézbesítési módként, rövidesen küldünk Önnek egy következő lépéseket ismertető e-mailt, amely tartalmazza a csomag nyomon követéséhez szükséges információkat és az átvétellel kapcsolatos tudnivalókat. </p>

<p>Köszönjük türelmét és bizalmát, és reméljük, hogy rendelése hamarosan örömet okoz majd Önnek!</p>

<p>A rendelés száma: ${orderId}</p>
        
<p><strong>Vásárolt termékek:</strong></p>

${itemsDescription}

Üdvözlettel,
A Csodaásványok Csapat`
    };

    let notificationMailOptions = {
        from: 'csodaasvanyok@gmail.com',
        to: 'csodaasvanyok@gmail.com',
        subject: 'Csodaásványok. Új rendelés!',
        html: `<p>A következő felhasználó terméket vásárolt: ${userEmail}</p>
        
        <p><strong>Vásárolt termékek:</strong></p>

        ${itemsDescription}
        
        További részletért:
        https://csodaasvanyok-admin.vercel.app/orders`
    };

    transporter.sendMail(customerMailOptions, function (error, info) {
        if (error) {
            console.log(error);
        } else {
            console.log('Email sent: ' + info.response);
        }
    });

    transporter.sendMail(notificationMailOptions, function (error, info) {
        if (error) {
            console.log(error);
        } else {
            console.log('Notification Email sent: ' + info.response);
        }
    });
}

const deliveryTruckPNGPath =
    'https://csodaasvanyok-bucket.s3.eu-central-1.amazonaws.com/delivery-truck.png';

router.get(`/`, async (req, res) => {
    try {
        const orderList = await Order.find().populate('user', 'name').sort({ dateOrdered: -1 });

        if (!orderList || orderList.length === 0) {
            return res.status(200).json([]);
        }
        res.status(200).json(orderList);
    } catch (error) {
        console.error('Error fetching orders: ', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

router.get(`/:id`, async (req, res) => {
    const { id } = req.params;

    if (!id || !mongoose.isValidObjectId(id)) {
        return res.status(400).json({ success: false, message: 'Invalid or missing ID' });
    }
    try {
        const order = await Order.findById(id)
            .populate('user', 'name')
            .populate({
                path: 'orderItems',
                populate: {
                    path: 'product',
                    populate: 'category'
                }
            });

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }
        res.status(200).json(order);
    } catch (error) {
        console.error('Error getting order by ID: ', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

router.post('/temp-order', async (req, res) => {
    try {
        const orderItemsIds = Promise.all(
            req.body.deliveryInfo.orderItems.map(async (orderitem) => {
                let newOrderItem = new OrderItem({
                    product: orderitem.id,
                    quantity: orderitem.quantity,
                    size: orderitem.size
                });

                newOrderItem = await newOrderItem.save();
                return newOrderItem._id;
            })
        );

        const orderItemsIdsResolved = await orderItemsIds;

        let tempOrder = new Order({
            orderItems: orderItemsIdsResolved,
            shippingAddress1: req.body.deliveryInfo.shippingAddress1,
            city: req.body.deliveryInfo.city,
            zip: req.body.deliveryInfo.zip,
            country: req.body.deliveryInfo.country,
            phone: req.body.deliveryInfo.phone,
            status: req.body.deliveryInfo.status,
            totalPrice: req.body.deliveryInfo.totalPrice,
            name: req.body.deliveryInfo.name,
            user: req.body.deliveryInfo.user,
            email: req.body.deliveryInfo.email,
            deliveryMethod: req.body.deliveryInfo.deliveryMethod
        });

        tempOrder = await tempOrder.save();

        if (!tempOrder) {
            return res
                .status(400)
                .json({ success: false, message: 'Temporary order creation unsuccessful!' });
        }

        res.status(200).json({ tempOrderId: tempOrder._id });
    } catch (error) {
        console.error('Error creating temporary order', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

router.post('/', async (req, res) => {
    const sessionId = req.body.sessionId;
    const tempOrderId = req.body.tempOrderId;
    try {
        const session = await stripe.checkout.sessions.retrieve(sessionId);

        if (session.payment_status !== 'paid') {
            return res.status(400).send('Payment not successful');
        }

        let order = await Order.findById(tempOrderId).populate({
            path: 'orderItems',
            populate: {
                path: 'product',
                model: 'Product'
            }
        });

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Temporary order not found when creating order.'
            });
        }

        order.status = 1;

        order = await order.save();

        await sendOrderConfirmationEmail(order._id, order.email, order.orderItems);
        res.status(200).json(order);
    } catch (error) {
        console.error('Error posting order: ', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

router.post('/create-checkout-session', async (req, res) => {
    try {
        const orderItems = req.body.items;
        const deliveryFee = req.body.deliveryFee;
        const userEmail = req.body.email;

        if (!orderItems) return res.status(400).send('No order items');

        const lineItems = await Promise.all(
            orderItems.map(async (orderItem) => {
                const product = await Product.findById(orderItem.id);
                const price = orderItem.price;
                const lineItem = {
                    price_data: {
                        currency: 'huf',
                        product_data: {
                            name: `${product.name} (${orderItem.size})`,
                            images: [product.image]
                        },
                        unit_amount: price * 100
                    },
                    quantity: orderItem.quantity
                };
                return lineItem;
            })
        );

        if (deliveryFee > 0) {
            lineItems.push({
                price_data: {
                    currency: 'huf',
                    product_data: {
                        name: 'Szállítási díj',
                        images: [deliveryTruckPNGPath]
                    },
                    unit_amount: deliveryFee * 100
                },
                quantity: 1
            });
        } else {
            lineItems.push({
                price_data: {
                    currency: 'huf',
                    product_data: {
                        name: 'Szállítási díj',
                        images: [deliveryTruckPNGPath]
                    },
                    unit_amount: 0
                },
                quantity: 1
            });
        }

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            customer_email: userEmail,
            line_items: lineItems,
            mode: 'payment',
            success_url: `${SITE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${SITE_URL}/cancel`,
            locale: 'hu'
        });
        res.status(200).json({ id: session.id });
    } catch (error) {
        console.error('Error during create-checkout-session: ', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while creating the checkout session'
        });
    }
});

router.put('/:id', async (req, res) => {
    const { id } = req.params;

    if (!id || !mongoose.isValidObjectId(id)) {
        return res.status(400).json({ success: false, message: 'Invalid or missing ID' });
    }
    try {
        if (!req.body.status) {
            return res.status(400).json({ success: false, message: 'Order status required!' });
        }
        const order = await Order.findByIdAndUpdate(
            req.params.id,
            {
                status: req.body.status
            },
            { new: true }
        );

        if (!order) return res.status(400).send('Order not found!');

        res.status(200).json(order);
    } catch (error) {
        console.error('Error updating order: ', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

router.delete('/:id', async (req, res) => {
    const { id } = req.params;

    if (!id || !mongoose.isValidObjectId(id)) {
        return res.status(400).json({ success: false, message: 'Invalid or missing ID' });
    }

    try {
        const order = await Order.findByIdAndRemove(id);

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (order.orderItems && order.orderItems.length > 0) {
            await Promise.all(
                order.orderItems.map(async (orderItemId) => {
                    await OrderItem.findByIdAndRemove(orderItemId);
                })
            );
        }

        res.status(200).json({ success: true, message: 'The order is deleted successfully' });
    } catch (error) {
        console.error('Error deleting order: ', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

router.get('/get/totalsales', async (req, res) => {
    try {
        const totalSales = await Order.aggregate([
            { $group: { _id: null, totalsales: { $sum: '$totalPrice' } } }
        ]);

        if (!totalSales || totalSales.length === 0) {
            return res.send({ totalsales: 0 });
        }

        res.send({ totalsales: totalSales[0].totalsales });
    } catch (error) {
        console.error('Error getting total sales: ', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

router.get(`/get/count`, async (req, res) => {
    try {
        const orderCount = await Order.countDocuments((count) => count);

        if (!orderCount) {
            return res.send({ orderCount: 0 });
        }
        res.send({
            orderCount: orderCount
        });
    } catch (error) {
        console.error('Error getting order count: ', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

//TODO
router.get(`/get/userorders/:userid`, async (req, res) => {
    try {
        const userOrderList = await Order.find({ user: req.params.userid })
            .populate({
                path: 'orderItems',
                populate: {
                    path: 'product',
                    populate: 'category'
                }
            })
            .sort({ dateOrdered: -1 });

        if (!userOrderList) {
            return res.status(500).json({ success: false });
        }
        res.send(userOrderList);
    } catch (error) {
        console.error('Error getting userOrders: ', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

router.get(`/:id`, async (req, res) => {
    const { id } = req.params;

    if (!id || !mongoose.isValidObjectId(id)) {
        return res.status(400).json({ success: false, message: 'Invalid or missing ID' });
    }
    try {
        const order = await Order.findById(id).populate({
            path: 'orderItems',
            populate: {
                path: 'product',
                model: 'Product'
            }
        });

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        res.status(200).json(order);
    } catch (error) {
        console.error('Error getting order: ', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

module.exports = router;

const { Order } = require('../models/order');
const express = require('express');
const { OrderItem } = require('../models/order-item');
const { Product } = require('../models/product');
const router = express.Router();

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = require('stripe')(stripeSecretKey);

const nodemailer = require('nodemailer');

async function sendOrderConfirmationEmail(userEmail) {
    let transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: 'csodaasvanyok@gmail.com',
            pass: `${process.env.EMAIL_PASSWORD}`
        }
    });

    let mailOptions = {
        from: 'csodaasvanyok@gmail.com',
        to: userEmail,
        subject: 'Csodaásványok Rendelés Visszaigazolása',
        text: `Tisztelt Vásárlónk!

Szeretnénk megköszönni, hogy a Csodaásványok webáruházat választotta. Örömmel értesítjük, hogy rendelését sikeresen rögzítettük, és az jelenleg feldolgozás alatt áll. Amennyiben a FoxPost Csomagautomatát választotta kézbesítési módként, rövidesen küldünk Önnek egy következő lépéseket ismertető e-mailt, amely tartalmazza a csomag nyomon követéséhez szükséges információkat és az átvétellel kapcsolatos tudnivalókat.

Köszönjük türelmét és bizalmát, és reméljük, hogy rendelése hamarosan örömet okoz majd Önnek!

Üdvözlettel,
A Csodaásványok Csapat`
    };

    transporter.sendMail(mailOptions, function (error, info) {
        if (error) {
            console.log(error);
        } else {
            console.log('Email sent: ' + info.response);
        }
    });
}

const deliveryTruckPNGPath =
    'https://csodaasvanyok-bucket.s3.eu-central-1.amazonaws.com/delivery-truck.png';

router.get(`/`, async (req, res) => {
    const orderList = await Order.find().populate('user', 'name').sort({ dateOrdered: -1 });

    if (!orderList) {
        res.status(500).json({ success: false });
    }
    res.send(orderList);
});

router.get(`/:id`, async (req, res) => {
    const order = await Order.findById(req.params.id)
        .populate('user', 'name')
        .populate({
            path: 'orderItems',
            populate: {
                path: 'product',
                populate: 'category'
            }
        });

    if (!order) {
        res.status(500).json({ success: false });
    }
    res.send(order);
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
            throw new Error('Temporary order creation failed');
        }

        res.status(200).json({ tempOrderId: tempOrder._id });
    } catch (error) {
        res.status(500).send(error.message);
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

        let order = await Order.findById(tempOrderId);

        if (!order) {
            throw new Error('Temporary order not found');
        }

        order.status = 1;

        order = await order.save();

        await sendOrderConfirmationEmail(order.email);
        res.status(200).json(order);
    } catch (error) {
        res.status(500).send(error.message);
    }
});

router.post('/create-checkout-session', async (req, res) => {
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
        success_url: 'https://www.csodaasvanyok.hu/success?session_id={CHECKOUT_SESSION_ID}',
        cancel_url: 'https://www.csodaasvanyok.hu/cancel',
        locale: 'hu'
    });
    res.json({ id: session.id });
});

router.put('/:id', async (req, res) => {
    const order = await Order.findByIdAndUpdate(
        req.params.id,
        {
            status: req.body.status
        },
        { new: true }
    );

    if (!order) return res.status(400).send('the order cannot be update!');

    res.send(order);
});

router.delete('/:id', (req, res) => {
    Order.findByIdAndRemove(req.params.id)
        .then(async (order) => {
            if (order) {
                await order.orderItems.map(async (orderItem) => {
                    await OrderItem.findByIdAndRemove(orderItem);
                });
                return res.status(200).json({ success: true, message: 'the order is deleted!' });
            } else {
                return res.status(404).json({ success: false, message: 'order not found!' });
            }
        })
        .catch((err) => {
            return res.status(500).json({ success: false, error: err });
        });
});

router.get('/get/totalsales', async (req, res) => {
    const totalSales = await Order.aggregate([
        { $group: { _id: null, totalsales: { $sum: '$totalPrice' } } }
    ]);

    if (!totalSales || totalSales.length === 0) {
        return res.status(400).send('The order sales cannot be generated');
    }

    res.send({ totalsales: totalSales[0].totalsales });
});

router.get(`/get/count`, async (req, res) => {
    const orderCount = await Order.countDocuments((count) => count);

    if (!orderCount) {
        res.status(500).json({ success: false });
    }
    res.send({
        orderCount: orderCount
    });
});

router.get(`/get/userorders/:userid`, async (req, res) => {
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
        res.status(500).json({ success: false });
    }
    res.send(userOrderList);
});

router.get(`/:id`, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id).populate({
            path: 'orderItems',
            populate: {
                path: 'product',
                model: 'Product'
            }
        });

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        res.json(order);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;

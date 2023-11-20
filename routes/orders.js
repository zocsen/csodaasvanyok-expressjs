const { Order } = require('../models/order');
const express = require('express');
const { OrderItem } = require('../models/order-item');
const { Product } = require('../models/product');
const router = express.Router();

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = require('stripe')(stripeSecretKey);

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

router.post('/', async (req, res) => {
    const orderItemsIds = Promise.all(
        req.body.orderItems.map(async (orderitem) => {
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

    let order = new Order({
        orderItems: orderItemsIdsResolved,
        shippingAddress1: req.body.shippingAddress1,
        city: req.body.city,
        zip: req.body.zip,
        country: req.body.country,
        phone: req.body.phone,
        status: req.body.status,
        totalPrice: req.body.totalPrice,
        name: req.body.name,
        user: req.body.user,
        email: req.body.email
    });
    order = await order.save();

    if (!order) return res.status(400).send('the order cannot be created!');

    res.status(200).send(order);
});

router.post('/create-checkout-session', async (req, res) => {
    const orderItems = req.body.items;

    if (!orderItems) return res.status(400).send('No order items');

    const lineItems = await Promise.all(
        orderItems.map(async (orderItem) => {
            const product = await Product.findById(orderItem.id);
            const price = orderItem.price;
            const lineItem = {
                price_data: {
                    currency: 'huf',
                    product_data: {
                        name: product.name,
                        images: [product.image]
                    },
                    unit_amount: price * 100
                },
                quantity: orderItem.quantity
            };
            return lineItem;
        })
    );
    const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: lineItems,
        mode: 'payment',
        success_url: 'https://www.csodaasvanyok.hu/success',
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

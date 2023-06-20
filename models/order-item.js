const mongoose = require('mongoose');

const orderItemSchema = mongoose.Schema({
    quantity: {
        type: Number,
        required: true
    },
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product'
    },
    size: {
        type: String,
    }
})

exports.OrderItem = mongoose.model('OrderItem', orderItemSchema);


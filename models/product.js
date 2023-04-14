const mongoose = require('mongoose');

const productSchema = mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        required: true
    },
    image: {
        type: String,
        default: ''
    },
    images: [{
        type: String
    }],
    price : {
        type: Number,
        default:0
    },
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: true,
    },
    mineral: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Mineral',
        required: true
    }],
    subcategory: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subcategory',
        required: true,
    }],
    color: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Color',
        required: true
    }],
    // isFeatured: {
    //     type: Boolean,
    //     default: false,
    // },
    dateCreated: {
        type: Date,
        default: Date.now,
    },
})

productSchema.virtual('id').get(function () {
    return this._id.toHexString();
});

productSchema.set('toJSON', {
    virtuals: true,
});


exports.Product = mongoose.model('Product', productSchema);

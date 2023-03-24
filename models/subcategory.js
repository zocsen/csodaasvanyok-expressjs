const mongoose = require('mongoose');

const subcategorySchema = mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    description: {
        type: String,
    },
})


subcategorySchema.virtual('id').get(function () {
    return this._id.toHexString();
});

subcategorySchema.set('toJSON', {
    virtuals: true,
});

exports.Subcategory = mongoose.model('Subcategory', subcategorySchema);

const mongoose = require('mongoose');

const benefitSchema = mongoose.Schema({
    name: {
        type: String,
        required: true,
    }
})


benefitSchema.virtual('id').get(function () {
    return this._id.toHexString();
});

benefitSchema.set('toJSON', {
    virtuals: true,
});

exports.Benefit = mongoose.model('Benefit', benefitSchema);

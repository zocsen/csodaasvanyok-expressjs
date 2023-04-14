const mongoose = require('mongoose');

const colorSchema = mongoose.Schema({
    name: {
        type: String,
        required: true,
	},
	code: {
        type: String,
        required: true,
    }
})


colorSchema.virtual('id').get(function () {
    return this._id.toHexString();
});

colorSchema.set('toJSON', {
    virtuals: true,
});

exports.Color = mongoose.model('Color', colorSchema);

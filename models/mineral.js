const mongoose = require('mongoose');

const mineralSchema = mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    description: {
        type: String,
    },
    benefit: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Benefit',
    }]
})


mineralSchema.virtual('id').get(function () {
    return this._id.toHexString();
});

mineralSchema.set('toJSON', {
    virtuals: true,
});

exports.Mineral = mongoose.model('Mineral', mineralSchema);

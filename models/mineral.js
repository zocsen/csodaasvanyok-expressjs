const mongoose = require('mongoose');

const mineralSchema = mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    description: {
        type: String,
    },
    color: { 
        type: String,
    }
})


mineralSchema.virtual('id').get(function () {
    return this._id.toHexString();
});

mineralSchema.set('toJSON', {
    virtuals: true,
});

exports.Mineral = mongoose.model('Mineral', mineralSchema);

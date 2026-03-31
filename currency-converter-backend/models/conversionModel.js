const mongoose = require('mongoose');

const conversionSchema = new mongoose.Schema({
    fromCurrency: { type: String, required: true, uppercase: true },
    toCurrency: { type: String, required: true, uppercase: true },
    amount: { type: Number, required: true },
    convertedAmount: { type: Number, required: true },
    rate: { type: Number, required: true },
    ipAddress: { type: String, default: 'unknown' },
    timestamp: { type: Date, default: Date.now },
        userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },

    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null }
});
 
module.exports = mongoose.model('Conversion', conversionSchema);
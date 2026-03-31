const express = require('express');
const axios = require('axios');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 7000;

// Middleware
app.use(cors());
app.use(express.json());

// ============= MONGODB CONNECTION =============
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ MongoDB Connected Successfully!'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err));

// ============= SCHEMA =============
const conversionSchema = new mongoose.Schema({
    fromCurrency: { type: String, required: true, uppercase: true },
    toCurrency: { type: String, required: true, uppercase: true },
    amount: { type: Number, required: true },
    convertedAmount: { type: Number, required: true },
    rate: { type: Number, required: true },
    ipAddress: { type: String, default: 'unknown' },
    timestamp: { type: Date, default: Date.now },

    // ✅ Soft Delete Fields
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null }
});

const Conversion = mongoose.model('Conversion', conversionSchema);

// Helper IP
const getClientIp = (req) => {
    return req.headers['x-forwarded-for'] || req.connection.remoteAddress;
};

const API_URL = `https://v6.exchangerate-api.com/v6/${process.env.EXCHANGE_RATE_API_KEY}`;

// ============= 1. CONVERT =============
app.get('/api/convert', async (req, res) => {
    try {
        const { from, to, amount } = req.query;

        if (!from || !to || !amount) {
            return res.status(400).json({
                success: false,
                message: "Provide from, to and amount"
            });
        }

        const response = await axios.get(`${API_URL}/latest/${from.toUpperCase()}`);
        const rate = response.data.conversion_rates[to.toUpperCase()];

        if (!rate) {
            return res.status(400).json({
                success: false,
                message: `Invalid currency: ${to}`
            });
        }

        const convertedAmount = amount * rate;

        const conversion = new Conversion({
            fromCurrency: from,
            toCurrency: to,
            amount: parseFloat(amount),
            convertedAmount: parseFloat(convertedAmount.toFixed(2)),
            rate,
            ipAddress: getClientIp(req)
        });

        await conversion.save();

        res.json({
            success: true,
            from: from.toUpperCase(),
            to: to.toUpperCase(),
            amount: parseFloat(amount),
            convertedAmount: convertedAmount.toFixed(2),
            rate,
            conversionId: conversion._id
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Conversion failed",
            error: error.message
        });
    }
});

// ============= 2. HISTORY (FILTERED) =============
app.get('/api/history', async (req, res) => {
    try {
        const { limit = 10, page = 1 } = req.query;
        const skip = (page - 1) * limit;

        const history = await Conversion.find({ isDeleted: false })
            .sort({ timestamp: -1 })
            .limit(parseInt(limit))
            .skip(skip);

        const total = await Conversion.countDocuments({ isDeleted: false });

        res.json({
            success: true,
            history,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalRecords: total
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "History fetch error",
            error: error.message
        });
    }
});

// ============= 3. STATISTICS (IGNORE DELETED) =============
app.get('/api/statistics', async (req, res) => {
    try {
        const matchStage = { $match: { isDeleted: false } };

        const topFromCurrencies = await Conversion.aggregate([
            matchStage,
            { $group: { _id: "$fromCurrency", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 5 }
        ]);

        const topToCurrencies = await Conversion.aggregate([
            matchStage,
            { $group: { _id: "$toCurrency", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 5 }
        ]);

        const totalConversions = await Conversion.countDocuments({ isDeleted: false });

        const avgAmount = await Conversion.aggregate([
            matchStage,
            { $group: { _id: null, average: { $avg: "$amount" } } }
        ]);

        res.json({
            success: true,
            statistics: {
                totalConversions,
                averageAmount: avgAmount[0]?.average?.toFixed(2) || 0,
                mostConvertedFrom: topFromCurrencies,
                mostConvertedTo: topToCurrencies
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Statistics error",
            error: error.message
        });
    }
});

// ============= 4. SOFT DELETE =============
app.delete('/api/history/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const deleted = await Conversion.findByIdAndUpdate(
            id,
            {
                isDeleted: true,
                deletedAt: new Date()
            },
            { new: true }
        );

        if (!deleted) {
            return res.status(404).json({
                success: false,
                message: "Record not found"
            });
        }

        res.json({
            success: true,
            message: "conversion deleted successfully"
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Delete failed",
            error: error.message
        });
    }
});

// ============= 5. CLEAR ALL (SOFT) =============
app.delete('/api/history/clear/all', async (req, res) => {
    try {
        await Conversion.updateMany(
            { isDeleted: false },
            { isDeleted: true, deletedAt: new Date() }
        );

        res.json({
            success: true,
            message: "All history soft deleted"
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Clear failed",
            error: error.message
        });
    }
});

// ============= 6. RESTORE (BONUS) =============
app.put('/api/history/restore/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const restored = await Conversion.findByIdAndUpdate(
            id,
            { isDeleted: false, deletedAt: null },
            { new: true }
        );

        res.json({
            success: true,
            message: "Restored successfully",
            data: restored
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Restore failed",
            error: error.message
        });
    }
});

// ============= 7. POPULAR RATES =============
app.get('/api/popular-rates', async (req, res) => {
    try {
        const popularCurrencies = ['USD', 'EUR', 'GBP', 'INR', 'AED', 'SAR', 'CAD', 'AUD'];
        const response = await axios.get(`${API_URL}/latest/PKR`);

        const rates = {};
        popularCurrencies.forEach(c => {
            if (response.data.conversion_rates[c]) {
                rates[c] = response.data.conversion_rates[c];
            }
        });

        res.json({
            success: true,
            base: 'PKR',
            rates
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Rates error",
            error: error.message
        });
    }
});

// ============= HEALTH =============
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        db: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
    });
});

// ============= START SERVER =============
app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
});
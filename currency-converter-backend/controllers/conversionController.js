const axios = require('axios');
const Conversion = require('../models/conversionModel');

const API_URL = `https://v6.exchangerate-api.com/v6/${process.env.EXCHANGE_RATE_API_KEY}`;

// Helper to get client IP
const getClientIp = (req) => req.headers['x-forwarded-for'] || req.connection.remoteAddress;

// ========== Convert Currency ==========
exports.convertCurrency = async (req, res) => {
    try {
        const { from, to, amount } = req.query;
        if (!from || !to || !amount)
            return res.status(400).json({ success: false, message: "Provide from, to and amount" });

        const response = await axios.get(`${API_URL}/latest/${from.toUpperCase()}`);
        const rate = response.data.conversion_rates[to.toUpperCase()];

        if (!rate) return res.status(400).json({ success: false, message: `Invalid currency: ${to}` });

        const convertedAmount = amount * rate;

        const conversion = await Conversion.create({
            fromCurrency: from,
            toCurrency: to,
            amount: parseFloat(amount),
            convertedAmount: parseFloat(convertedAmount.toFixed(2)),
            rate,
            ipAddress: getClientIp(req)
        });

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
        res.status(500).json({ success: false, message: "Conversion failed", error: error.message });
    }
};

// ========== Get History ==========
exports.getHistory = async (req, res) => {
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
        res.status(500).json({ success: false, message: "History fetch error", error: error.message });
    }
};

// ========== Statistics ==========
exports.getStatistics = async (req, res) => {
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
        res.status(500).json({ success: false, message: "Statistics error", error: error.message });
    }
};

// ========== Soft Delete ==========
exports.softDelete = async (req, res) => {
    try {
        const { id } = req.params;

        const deleted = await Conversion.findByIdAndUpdate(
            id,
            { isDeleted: true, deletedAt: new Date() },
            { new: true }
        );

        if (!deleted) return res.status(404).json({ success: false, message: "Record not found" });

        res.json({ success: true, message: "Record soft deleted" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Delete failed", error: error.message });
    }
};

// ========== Soft Delete All ==========
exports.softDeleteAll = async (req, res) => {
    try {
        await Conversion.updateMany(
            { isDeleted: false },
            { isDeleted: true, deletedAt: new Date() }
        );

        res.json({ success: true, message: "All records soft deleted" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Clear failed", error: error.message });
    }
};

// ========== Restore ==========
exports.restore = async (req, res) => {
    try {
        const { id } = req.params;

        const restored = await Conversion.findByIdAndUpdate(
            id,
            { isDeleted: false, deletedAt: null },
            { new: true }
        );

        res.json({ success: true, message: "Restored successfully", data: restored });
    } catch (error) {
        res.status(500).json({ success: false, message: "Restore failed", error: error.message });
    }
};

// ========== Popular Rates ==========
exports.getPopularRates = async (req, res) => {
    try {
        const popularCurrencies = ['USD', 'EUR', 'GBP', 'INR', 'AED', 'SAR', 'CAD', 'AUD'];
        const response = await axios.get(`${API_URL}/latest/PKR`);

        const rates = {};
        popularCurrencies.forEach(c => {
            if (response.data.conversion_rates[c]) rates[c] = response.data.conversion_rates[c];
        });

        res.json({ success: true, base: 'PKR', rates });
    } catch (error) {
        res.status(500).json({ success: false, message: "Rates error", error: error.message });
    }
};

// ========== Health ==========
exports.healthCheck = (req, res) => {
    res.json({
        status: 'OK',
        db: require('mongoose').connection.readyState === 1 ? 'Connected' : 'Disconnected'
    });
};
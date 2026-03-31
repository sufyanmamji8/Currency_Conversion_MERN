const express = require('express');
const { protect } = require('../middleware/auth');
const router = express.Router();
const {
    convertCurrency,
    getHistory,
    getStatistics,
    softDelete,
    softDeleteAll,
    restore,
    getPopularRates,
    healthCheck
} = require('../controllers/conversionController');

router.get('/convert', protect,  convertCurrency);
router.get('/history', protect, getHistory);
router.get('/statistics', protect, getStatistics);
router.delete('/history/:id', protect, softDelete);
router.delete('/history/clear/all', protect, softDeleteAll);
router.put('/history/restore/:id', protect, restore);
router.get('/popular-rates',protect ,  getPopularRates);
router.get('/health', protect, healthCheck);

module.exports = router;
const express = require('express');
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

router.get('/convert', convertCurrency);
router.get('/history', getHistory);
router.get('/statistics', getStatistics);
router.delete('/history/:id', softDelete);
router.delete('/history/clear/all', softDeleteAll);
router.put('/history/restore/:id', restore);
router.get('/popular-rates', getPopularRates);
router.get('/health', healthCheck);

module.exports = router;
const express = require('express');
const router = express.Router();
const { verifyToken, requireRole } = require('../middleware/auth');
const { dailyReport, monthlyReport } = require('../controllers/reportController');

router.get('/daily', verifyToken, requireRole('admin', 'organizer'), dailyReport);
router.get('/monthly', verifyToken, requireRole('admin', 'organizer'), monthlyReport);

module.exports = router;

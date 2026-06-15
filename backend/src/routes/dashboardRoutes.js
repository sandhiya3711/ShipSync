const express = require('express');
const { getMetrics } = require('../controllers/dashboardController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/metrics', authenticateToken, getMetrics);

module.exports = router;

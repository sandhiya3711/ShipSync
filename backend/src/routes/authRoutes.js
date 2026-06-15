const express = require('express');
const { login, getMe } = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.post('/login', login);
router.get('/me', authenticateToken, getMe);

module.exports = router;

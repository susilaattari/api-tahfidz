const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authLimiter } = require('../../middlewares/rateLimiter.middleware');

router.post('/login', authLimiter, authController.login);
router.get('/me', authenticate, authController.me);
router.post('/logout', authenticate, authController.logout);
router.put('/password', authenticate, authController.changePassword);
router.post('/password', authenticate, authController.changePassword);

module.exports = router;


const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');
const { authLimiter } = require('../../middlewares/rateLimiter.middleware');

router.post('/login', authLimiter, authController.login);
router.post('/send-otp', authLimiter, authController.sendOtp);
router.post('/verify-otp', authLimiter, authController.verifyOtp);
router.get('/me', authenticate, authController.me);
router.post('/logout', authenticate, authController.logout);
router.put('/password', authenticate, authController.changePassword);
router.post('/password', authenticate, authController.changePassword);

// Superadmin Impersonation
router.post('/impersonate/:tenantId', authenticate, authorize('super_admin'), authController.impersonate);

module.exports = router;



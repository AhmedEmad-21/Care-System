const express = require('express');
const authMW = require('../middlewares/authMW');
const { authLimiter } = require('../middlewares/rateLimiterMW');
const authController = require('../controllers/authController');

const router = express.Router();

router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);
router.post('/refresh-token', authController.refreshToken);
router.post('/reset-password', authLimiter, authController.resetPassword);
router.post('/verify-otp', authLimiter, authController.verifyOtp);
router.post('/reset-password-final', authLimiter, authController.resetPasswordFinal);
router.get('/me', authMW, authController.me);
router.patch('/profile', authMW, authController.updateProfile);
router.post('/logout', authMW, authController.logout);

module.exports = router;
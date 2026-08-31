const express = require('express');
const authMW = require('../middlewares/authMW');
const validateAjvMW = require('../middlewares/validateAjvMW');
const { authLimiter } = require('../middlewares/rateLimiterMW');
const authController = require('../controllers/authController');
const registerSchema = require('../utils/authRegisterValidate');
const loginSchema = require('../utils/authLoginValidate');
const profileSchema = require('../utils/authProfileValidate');

const router = express.Router();

router.post('/register', authLimiter, validateAjvMW(registerSchema), authController.register);
router.post('/login', authLimiter, validateAjvMW(loginSchema), authController.login);
router.post('/refresh-token', authController.refreshToken);
router.post('/reset-password', authLimiter, authController.resetPassword);
router.post('/verify-otp', authLimiter, authController.verifyOtp);
router.post('/reset-password-final', authLimiter, authController.resetPasswordFinal);
router.get('/me', authMW, authController.me);
router.patch('/profile', authMW, validateAjvMW(profileSchema), authController.updateProfile);
router.post('/logout', authMW, authController.logout);

module.exports = router;
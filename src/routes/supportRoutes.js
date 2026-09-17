const express = require('express');
const authMW = require('../middlewares/authMW');
const notificationController = require('../controllers/notificationController');

const router = express.Router();

// إرسال رسالة دعم فني وإشعار الاستاف والإدارة تلقائياً
router.post('/message', authMW, notificationController.sendSupportMessage);
router.post('/contact', authMW, notificationController.sendSupportMessage);

module.exports = router;

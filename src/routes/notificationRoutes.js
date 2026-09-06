const express = require('express');
const authMW = require('../middlewares/authMW');
const checkRoleMW = require('../middlewares/checkRoleMW');
const validateAjvMW = require('../middlewares/validateAjvMW');
const notificationSchema = require('../utils/notificationValidate');
const notificationDeleteSchema = require('../utils/notificationDeleteValidate');
const notificationBroadcastSchema = require('../utils/notificationBroadcastValidate');
const notificationController = require('../controllers/notificationController');

const router = express.Router();

router.post('/fcm-token', authMW, validateAjvMW(notificationSchema), notificationController.registerFcmToken);
router.delete('/fcm-token', authMW, validateAjvMW(notificationDeleteSchema), notificationController.deleteFcmToken);
router.get('/', authMW, notificationController.listNotifications);
router.patch('/:id/read', authMW, notificationController.markAsRead);
router.patch('/read-all', authMW, notificationController.markAllAsRead);
router.delete('/:id', authMW, notificationController.removeNotification);
router.post('/broadcast', authMW, checkRoleMW('STAFF', 'ADMIN'), validateAjvMW(notificationBroadcastSchema), notificationController.broadcastNotification);
router.post('/targeted', authMW, checkRoleMW('STAFF', 'ADMIN'), validateAjvMW(notificationBroadcastSchema), notificationController.targetedNotification);

module.exports = router;
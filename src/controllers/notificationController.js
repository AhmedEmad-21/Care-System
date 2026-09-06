const asyncHandler = require('../utils/asyncHandler');
const notificationService = require('../services/notificationService');

const registerFcmToken = asyncHandler(async (req, res) => {
  const userId = req.user.id || req.user._id;
  await notificationService.registerDeviceToken({
    userId,
    fcmToken: req.body.fcm_token,
    deviceType: req.body.device_type,
  });

  return res.json({
    status: 'success',
    message: 'FCM Token registered successfully',
  });
});

const deleteFcmToken = asyncHandler(async (req, res) => {
  const userId = req.user.id || req.user._id;
  await notificationService.removeDeviceToken({
    userId,
    fcmToken: req.body.fcm_token,
  });

  return res.json({
    status: 'success',
    message: 'Token removed',
  });
});

const listNotifications = asyncHandler(async (req, res) => {
  const userId = req.user.id || req.user._id;
  const result = await notificationService.getUserNotifications({ userId });

  return res.json({
    status: 'success',
    unread_count: result.unreadCount,
    data: result.notifications,
  });
});

const markAsRead = asyncHandler(async (req, res) => {
  const userId = req.user.id || req.user._id;
  await notificationService.markNotificationRead({
    userId,
    notificationId: req.params.id,
  });

  return res.json({
    status: 'success',
    message: 'Notification marked as read',
  });
});

const markAllAsRead = asyncHandler(async (req, res) => {
  const userId = req.user.id || req.user._id;
  await notificationService.markAllNotificationsRead({ userId });

  return res.json({
    status: 'success',
    message: 'All notifications marked as read',
  });
});

const removeNotification = asyncHandler(async (req, res) => {
  const userId = req.user.id || req.user._id;
  await notificationService.deleteNotification({
    userId,
    notificationId: req.params.id,
  });

  return res.json({
    status: 'success',
    message: 'Notification deleted',
  });
});

const broadcastNotification = asyncHandler(async (req, res) => {
  const createdBy = req.user.id || req.user._id;
  const result = await notificationService.sendBroadcastNotification({
    createdBy,
    title: req.body.title,
    body: req.body.body,
    type: req.body.type,
    data: req.body.data,
    targetAudience: req.body.targetAudience || 'all',
    userIds: req.body.userIds || [],
  });

  return res.status(201).json({
    status: 'success',
    message: 'Broadcast notification sent successfully',
    data: result,
  });
});

const targetedNotification = asyncHandler(async (req, res) => {
  const createdBy = req.user.id || req.user._id;
  const result = await notificationService.sendTargetedNotification({
    createdBy,
    title: req.body.title,
    body: req.body.body,
    type: req.body.type,
    data: req.body.data,
    userIds: req.body.userIds || [],
  });

  return res.status(201).json({
    status: 'success',
    message: 'Targeted notification sent successfully',
    data: result,
  });
});

module.exports = {
  registerFcmToken,
  deleteFcmToken,
  listNotifications,
  markAsRead,
  markAllAsRead,
  removeNotification,
  broadcastNotification,
  targetedNotification,
};
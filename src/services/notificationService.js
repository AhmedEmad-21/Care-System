require('../config/firebase');
const { getApp } = require('firebase-admin/app');
const { getMessaging } = require('firebase-admin/messaging');
const mongoose = require('mongoose');
const Notification = require('../models/notificationModel');
const UserDeviceToken = require('../models/userDeviceTokenModel');
const User = require('../models/userModel');
const { BadRequestError, NotFoundError } = require('../errors/appErrors');
const { enqueueNotificationJob } = require('./notificationQueueService');

const normalizeData = (data = {}) => {
  const normalized = {};
  for (const [key, value] of Object.entries(data || {})) {
    normalized[key] = String(value);
  }
  return normalized;
};

const registerDeviceToken = async ({ userId, fcmToken, deviceType }) => {
  const token = String(fcmToken || '').trim();
  if (!token) throw new BadRequestError('fcm_token is required');

  const storedToken = await UserDeviceToken.findOneAndUpdate(
    { fcmToken: token },
    { userId, fcmToken: token, deviceType },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return storedToken;
};

const removeDeviceToken = async ({ userId, fcmToken }) => {
  const result = await UserDeviceToken.deleteOne({
    userId,
    fcmToken: String(fcmToken || '').trim(),
  });

  return result.deletedCount > 0;
};

const getUserNotifications = async ({ userId }) => {
  const [notifications, unreadCount] = await Promise.all([
    Notification.find({ userId }).sort({ createdAt: -1 }).lean(),
    Notification.countDocuments({ userId, isRead: false }),
  ]);

  return {
    unreadCount,
    notifications,
  };
};

const markNotificationRead = async ({ userId, notificationId }) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, userId },
    { isRead: true },
    { new: true }
  );

  if (!notification) throw new NotFoundError('Notification not found');
  return notification;
};

const markAllNotificationsRead = async ({ userId }) => {
  const result = await Notification.updateMany({ userId, isRead: false }, { isRead: true });
  return result;
};

const deleteNotification = async ({ userId, notificationId }) => {
  const result = await Notification.deleteOne({ _id: notificationId, userId });
  if (!result.deletedCount) throw new NotFoundError('Notification not found');
  return true;
};

const cleanupInvalidTokens = async (tokens) => {
  if (!tokens.length) return;
  await UserDeviceToken.deleteMany({ fcmToken: { $in: tokens } });
};

const buildAudienceFilter = ({ targetAudience = 'all', userIds = [] }) => {
  switch (targetAudience) {
    case 'all':
      return {};
    case 'active_users':
      return { accountStatus: 'active' };
    case 'patients':
      return { role: 'Patient', accountStatus: 'active' };
    case 'doctors':
      return { role: 'Doctor', accountStatus: 'active' };
    case 'nurses':
      return { role: 'Nurse', accountStatus: 'active' };
    case 'staff':
      return { role: 'Staff', accountStatus: 'active' };
    case 'admins':
      return { role: 'Admin', accountStatus: 'active' };
    case 'ids':
      return { _id: { $in: userIds.filter((id) => mongoose.isValidObjectId(id)).map((id) => new mongoose.Types.ObjectId(id)) } };
    default:
      throw new BadRequestError('Invalid targetAudience');
  }
};

const chunkArray = (items, size = 500) => {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const persistNotificationRecords = async ({ recipientIds, title, body, type, data, isBroadcast, targetAudience, createdBy }) => {
  const notifications = recipientIds.map((recipientId) => ({
    userId: recipientId,
    title,
    body,
    type,
    data,
    isBroadcast,
    targetAudience,
    createdBy,
    isRead: false,
  }));

  await Notification.insertMany(notifications, { ordered: false });
  return notifications.length;
};

const sendChunksToTokens = async ({ tokens, title, body, type, data, broadcast = false, targetAudience = 'all' }) => {
  let successCount = 0;
  let failureCount = 0;
  const invalidTokens = [];

  for (const tokenChunk of chunkArray(tokens, 500)) {
    const response = await getMessaging(getApp()).sendEachForMulticast({
      tokens: tokenChunk,
      notification: { title, body },
      data: {
        type: String(type),
        broadcast: String(broadcast),
        targetAudience: String(targetAudience),
        ...normalizeData(data),
      },
    });

    successCount += response.successCount;
    failureCount += response.failureCount;

    response.responses.forEach((item, index) => {
      if (!item.success) {
        const code = item.error?.code;
        if (
          code === 'messaging/invalid-registration-token' ||
          code === 'messaging/registration-token-not-registered'
        ) {
          invalidTokens.push(tokenChunk[index]);
        }
      }
    });
  }

  await cleanupInvalidTokens(invalidTokens);

  return { successCount, failureCount };
};

const resolveRecipients = async ({ targetAudience = 'all', userIds = [] }) => {
  const audienceFilter = buildAudienceFilter({ targetAudience, userIds });
  const recipients = await User.find(audienceFilter).select('_id').lean();
  return recipients.map((user) => String(user._id));
};

const deliverBroadcastNotification = async ({ createdBy, title, body, type = 'general', data = {}, targetAudience = 'all', userIds = [] }) => {
  const recipientIds = await resolveRecipients({ targetAudience, userIds });
  if (!recipientIds.length) {
    return { successCount: 0, failureCount: 0, recipientCount: 0, notificationCount: 0 };
  }

  const notificationCount = await persistNotificationRecords({
    recipientIds,
    title,
    body,
    type,
    data,
    isBroadcast: true,
    targetAudience,
    createdBy,
  });

  const tokenDocs = await UserDeviceToken.find({ userId: { $in: recipientIds } }).lean();
  const tokens = Array.from(new Set(tokenDocs.map((doc) => doc.fcmToken).filter(Boolean)));

  if (!tokens.length) {
    return { successCount: 0, failureCount: 0, recipientCount: recipientIds.length, notificationCount };
  }

  const { successCount, failureCount } = await sendChunksToTokens({
    tokens,
    title,
    body,
    type,
    data,
    broadcast: true,
    targetAudience,
  });

  return { successCount, failureCount, recipientCount: recipientIds.length, notificationCount };
};

const deliverTargetedNotification = async ({ createdBy, title, body, type = 'general', data = {}, userIds = [] }) => {
  const recipientIds = userIds.filter((id) => mongoose.isValidObjectId(id)).map((id) => String(id));
  if (!recipientIds.length) {
    throw new BadRequestError('userIds must contain at least one valid user id');
  }

  const notificationCount = await persistNotificationRecords({
    recipientIds,
    title,
    body,
    type,
    data,
    isBroadcast: true,
    targetAudience: 'ids',
    createdBy,
  });

  const tokenDocs = await UserDeviceToken.find({ userId: { $in: recipientIds } }).lean();
  const tokens = Array.from(new Set(tokenDocs.map((doc) => doc.fcmToken).filter(Boolean)));

  if (!tokens.length) {
    return { successCount: 0, failureCount: 0, recipientCount: recipientIds.length, notificationCount };
  }

  const { successCount, failureCount } = await sendChunksToTokens({
    tokens,
    title,
    body,
    type,
    data,
    broadcast: true,
    targetAudience: 'ids',
  });

  return { successCount, failureCount, recipientCount: recipientIds.length, notificationCount };
};

const sendNotificationToUser = async ({ userId, title, body, type = 'general', data = {} }) => {
  const notification = await Notification.create({
    userId,
    title,
    body,
    type,
    data,
    isBroadcast: false,
    targetAudience: 'single_user',
    isRead: false,
  });

  const deviceTokens = await UserDeviceToken.find({ userId }).lean();
  const tokens = deviceTokens.map((entry) => entry.fcmToken).filter(Boolean);

  if (!tokens.length) {
    return { notification, sent: false, successCount: 0, failureCount: 0 };
  }

  const response = await getMessaging(getApp()).sendEachForMulticast({
    tokens,
    notification: { title, body },
    data: {
      type: String(type),
      notification_id: String(notification._id),
      ...normalizeData(data),
    },
  });

  const invalidTokens = [];
  response.responses.forEach((item, index) => {
    if (!item.success) {
      const code = item.error?.code;
      if (
        code === 'messaging/invalid-registration-token' ||
        code === 'messaging/registration-token-not-registered'
      ) {
        invalidTokens.push(tokens[index]);
      }
    }
  });

  await cleanupInvalidTokens(invalidTokens);

  return {
    notification,
    sent: true,
    successCount: response.successCount,
    failureCount: response.failureCount,
  };
};

const sendBroadcastNotification = async ({ createdBy, title, body, type = 'general', data = {}, targetAudience = 'all', userIds = [] }) => {
  const queueResult = await enqueueNotificationJob('broadcast', {
    createdBy,
    title,
    body,
    type,
    data,
    targetAudience,
    userIds,
  });

  if (queueResult) {
    return { queued: true, jobId: queueResult.id };
  }

  return deliverBroadcastNotification({ createdBy, title, body, type, data, targetAudience, userIds });
};

const sendTargetedNotification = async ({ createdBy, title, body, type = 'general', data = {}, userIds = [] }) => {
  const queueResult = await enqueueNotificationJob('targeted', {
    createdBy,
    title,
    body,
    type,
    data,
    userIds,
  });

  if (queueResult) {
    return { queued: true, jobId: queueResult.id };
  }

  return deliverTargetedNotification({ createdBy, title, body, type, data, userIds });
};

module.exports = {
  registerDeviceToken,
  removeDeviceToken,
  getUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  sendNotificationToUser,
  sendBroadcastNotification,
  sendTargetedNotification,
  deliverBroadcastNotification,
  deliverTargetedNotification,
};
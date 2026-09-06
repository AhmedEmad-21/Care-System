const { Worker } = require('bullmq');
const { createRedisConnection } = require('../config/redis');
const notificationService = require('../services/notificationService');

let workerInstance = null;

const startNotificationWorker = () => {
  if (workerInstance) return workerInstance;

  const connection = createRedisConnection();
  if (!connection) return null;

  workerInstance = new Worker(
    'notification-delivery',
    async (job) => {
      if (job.name === 'broadcast') {
        return notificationService.deliverBroadcastNotification(job.data);
      }

      if (job.name === 'targeted') {
        return notificationService.deliverTargetedNotification(job.data);
      }

      return null;
    },
    { connection }
  );

  workerInstance.on('failed', (job, err) => {
    console.error('Notification job failed', job?.name, err?.message);
  });

  return workerInstance;
};

module.exports = {
  startNotificationWorker,
};
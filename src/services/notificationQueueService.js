const { Queue } = require('bullmq');
const { createRedisConnection } = require('../config/redis');

let queueInstance = null;

const getNotificationQueue = () => {
  if (queueInstance) return queueInstance;

  const connection = createRedisConnection();
  if (!connection) return null;

  queueInstance = new Queue('notification-delivery', {
    connection,
  });

  return queueInstance;
};

const enqueueNotificationJob = async (jobName, payload) => {
  const queue = getNotificationQueue();
  if (!queue) return null;

  return queue.add(jobName, payload, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: true,
    removeOnFail: 1000,
  });
};

module.exports = {
  getNotificationQueue,
  enqueueNotificationJob,
};
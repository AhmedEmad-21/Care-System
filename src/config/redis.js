const IORedis = require('ioredis');

const createRedisConnection = () => {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;

  return new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
};

module.exports = {
  createRedisConnection,
};
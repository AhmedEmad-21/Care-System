module.exports = {
  type: 'object',
  additionalProperties: false,
  required: ['fcm_token', 'device_type'],
  properties: {
    fcm_token: { type: 'string', minLength: 1 },
    device_type: { enum: ['android', 'ios'] },
  },
};
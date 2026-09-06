module.exports = {
  type: 'object',
  additionalProperties: false,
  required: ['fcm_token'],
  properties: {
    fcm_token: { type: 'string', minLength: 1 },
  },
};
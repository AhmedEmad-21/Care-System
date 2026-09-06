module.exports = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'body'],
  properties: {
    title: { type: 'string', minLength: 1, maxLength: 200 },
    body: { type: 'string', minLength: 1, maxLength: 2000 },
    type: { type: 'string', minLength: 1, maxLength: 100 },
    data: {
      type: 'object',
      additionalProperties: true,
    },
    targetAudience: {
      type: 'string',
      enum: ['all', 'active_users', 'patients', 'doctors', 'nurses', 'staff', 'admins'],
    },
    userIds: {
      type: 'array',
      items: { type: 'string', minLength: 1 },
      minItems: 1,
      maxItems: 1000,
    },
  },
};
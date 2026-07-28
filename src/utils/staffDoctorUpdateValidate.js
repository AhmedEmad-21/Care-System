module.exports = {
  type: 'object',
  additionalProperties: false,
  required: ['basePrice'],
  properties: {
    basePrice: { type: 'number', minimum: 0 },
    specialization: { type: 'string', minLength: 1 },
    profileImage: { type: 'string', minLength: 1 },
    workingHours: {
      type: 'object',
      additionalProperties: false,
      properties: {
        start: { type: 'string', minLength: 1 },
        end: { type: 'string', minLength: 1 },
      },
    },
    offDays: {
      type: 'array',
      items: { type: 'integer', minimum: 0, maximum: 6 },
    },
    isAvailable: { type: 'boolean' },
  },
};
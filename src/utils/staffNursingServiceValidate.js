module.exports = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'basePrice'],
  properties: {
    name: { type: 'string', minLength: 1 },
    description: { type: 'string' },
    basePrice: { type: 'number', minimum: 0 },
    isActive: { type: 'boolean' },
  },
};
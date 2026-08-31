module.exports = {
  type: 'object',
  additionalProperties: false,
  minProperties: 1,
  properties: {
    name: { type: 'string', minLength: 1 },
    phoneNumber: { type: 'string', pattern: '^01[0125][0-9]{8}$' },
    address: { type: 'string', minLength: 1 },
    profileImage: { type: 'string', minLength: 1 },
    location: {
      type: 'object',
      additionalProperties: false,
      required: ['type', 'coordinates'],
      properties: {
        type: { const: 'Point' },
        coordinates: {
          type: 'array',
          minItems: 2,
          maxItems: 2,
          items: { type: 'number' },
        },
      },
    },
  },
};
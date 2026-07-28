module.exports = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'phoneNumber', 'address', 'location', 'basePrice', 'specialization'],
  properties: {
    name: { type: 'string', minLength: 1 },
    phoneNumber: { type: 'string', pattern: "^01[0125][0-9]{8}$" },
    secondaryPhoneNumber: { type: 'string', pattern: "^01[0125][0-9]{8}$" },
    address: { type: 'string', minLength: 1 },
    specialization: { type: 'string', minLength: 1 },
    basePrice: { type: 'number', minimum: 0 },
    profileImage: { type: 'string', minLength: 1 },
    location: {
      type: 'object',
      required: ['type', 'coordinates'],
      properties: {
        type: { const: 'Point' },
        coordinates: { type: 'array', minItems: 2, maxItems: 2, items: { type: 'number' } }
      }
    },
    workingHours: {
      type: 'object',
      properties: { start: { type: 'string' }, end: { type: 'string' } }
    },
    offDays: { type: 'array', items: { type: 'integer', minimum: 0, maximum: 6 } }
  }
};
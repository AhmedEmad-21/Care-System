module.exports = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'phoneNumber', 'location'],
  properties: {
    name: { type: 'string', minLength: 1 },
    phoneNumber: { type: 'string', pattern: "^01[0125][0-9]{8}$" },
    location: {
      type: 'object',
      required: ['type', 'coordinates'],
      properties: {
        type: { const: 'Point' },
        coordinates: { type: 'array', minItems: 2, maxItems: 2, items: { type: 'number' } }
      }
    },
    services: { type: 'array', items: { type: 'string' } },
    offDays: { 
      type: 'array', 
      items: { 
        type: 'integer', 
        minimum: 0, 
        maximum: 6 
      } 
    }
  }
};
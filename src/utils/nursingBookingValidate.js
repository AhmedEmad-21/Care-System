const geoPointSchema = {
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
};

module.exports = {
  type: 'object',
  additionalProperties: false,
  required: ['nurseId', 'serviceId', 'requestLocation'],
  properties: {
    nurseId: { type: 'string', minLength: 1 },
    serviceId: { type: 'string', minLength: 1 },
    requestLocation: geoPointSchema,
    appointmentTime: { type: 'string', format: 'date-time' },
  },
};
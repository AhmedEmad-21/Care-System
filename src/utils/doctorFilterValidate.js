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
  properties: {
    specialization: { type: 'string', minLength: 1 },
    requestLocation: geoPointSchema,
    maxDistanceMeters: { type: 'number', minimum: 1 },
  },
};
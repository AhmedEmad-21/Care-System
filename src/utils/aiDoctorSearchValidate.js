module.exports = {
  type: 'object',
  additionalProperties: false,
  required: ['specialty', 'appointmentDate', 'requestLocation'], // جعلناهم إجباريين هنا
  properties: {
    specialty: { type: 'string', minLength: 1 },
    appointmentDate: { type: 'string', minLength: 1 },
    allDoctors: { type: 'boolean' },
    maxDistanceMeters: { type: 'number', minimum: 1 },
    requestLocation: {
      type: 'object',
      additionalProperties: false,
      required: ['type', 'coordinates'], // نوع وموقع الإحداثيات إجباري أيضاً
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
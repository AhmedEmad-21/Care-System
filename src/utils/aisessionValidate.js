module.exports = {
  type: 'object',
  additionalProperties: false,
  required: ['symptoms', 'appointmentDate'], // جعلنا تاريخ الموعد إجبارياً هنا أيضاً
  properties: {
    symptoms: { type: 'string', minLength: 1 },
    maxDistanceMeters: { type: 'number', minimum: 1 },
    appointmentDate: { type: 'string', minLength: 1 }, // إضافة حقل التاريخ هنا ليتم قبوله وعدم حذفه
    requestLocation: {
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
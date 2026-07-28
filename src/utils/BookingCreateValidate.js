// 1. تعريف الـ Schema الفرعي أولاً
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

// 2. تصدير الـ Schema الرئيسي
module.exports = {
  type: 'object',
  additionalProperties: false,
  required: ['doctorId', 'appointmentTime'], // الـ Location لم يعد مطلوباً هنا
  properties: {
    doctorId: { type: 'string', minLength: 1 },
    nurseId: { type: 'string', minLength: 1 },
    requestLocation: geoPointSchema, // الآن هو معرف في الأعلى
    appointmentTime: { type: 'string', format: 'date-time' },
  },
  anyOf: [
    { required: ['doctorId'] },
    { required: ['nurseId'] },
  ],
};
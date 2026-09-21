module.exports = {
  type: 'object',
  additionalProperties: false,
  required: ['providerId', 'providerType', 'rating'],
  properties: {
    bookingId: { type: 'string', minLength: 1 },
    providerId: { type: 'string', minLength: 1 },
    providerType: { enum: ['Doctor', 'Nurse'] },
    rating: { type: 'integer', minimum: 1, maximum: 5 },
    comment: { type: 'string', maxLength: 2000 },
  },
};
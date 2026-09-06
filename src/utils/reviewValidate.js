module.exports = {
  type: 'object',
  additionalProperties: false,
  required: ['providerId', 'providerType', 'rating'],
  properties: {
    providerId: { type: 'string', minLength: 1 },
    providerType: { enum: ['Doctor', 'Nurse'] },
    rating: { type: 'integer', minimum: 1, maximum: 5 },
    comment: { type: 'string', minLength: 1, maxLength: 2000 },
  },
};
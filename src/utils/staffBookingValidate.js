module.exports = {
  type: 'object',
  additionalProperties: false,
  properties: {
    appointmentTime: { type: 'string', format: 'date-time' },
    status: {
      enum: ['pending', 'confirmed', 'cancelled', 'completed', 'rejected'],
    },
    staffNote: { type: 'string', minLength: 1 },
  },
  anyOf: [
    { required: ['appointmentTime'] },
    { required: ['status'] },
    { required: ['staffNote'] },
  ],
};
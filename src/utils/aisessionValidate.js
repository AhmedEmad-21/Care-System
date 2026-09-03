module.exports = {
  type: 'object',
  additionalProperties: false,
  required: ['symptoms'],
  properties: {
    symptoms: { type: 'string', minLength: 1 },
  },
};
module.exports = {
  type: 'object',
  additionalProperties: false,
  required: ['password'],
  properties: {
    email: { type: 'string', format: 'email' },
    phoneNumber: { type: 'string', pattern: "^01[0125][0-9]{8}$" },
    loginIdentifier: { type: 'string' },
    password: { type: 'string', minLength: 8 },
  },
  anyOf: [
    { required: ['email'] },
    { required: ['phoneNumber'] },
    { required: ['loginIdentifier'] },
  ],
};
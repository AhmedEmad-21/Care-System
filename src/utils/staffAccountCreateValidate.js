module.exports = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'email', 'password', 'role', 'phoneNumber'],
  properties: {
    name: { type: 'string', minLength: 1 },
    email: { type: 'string', format: 'email' },
    password: {
      type: 'string',
      minLength: 8,
      pattern: "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&#._-])[A-Za-z\\d@$!%*?&#._-]{8,}$",
    },
    role: { 
      type: 'string', 
      enum: ['Staff', 'Admin'] 
    },
    phoneNumber: {
      type: 'string',
      pattern: "^01[0125][0-9]{8}$"
    },
    address: {
      type: 'string'
    }
  }
};
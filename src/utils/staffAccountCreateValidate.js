module.exports = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'email', 'password', 'role'],
  properties: {
    name: { type: 'string', minLength: 1 },
    email: { type: 'string', format: 'email' },
    password: {
      type: 'string',
      minLength: 8,
      pattern: "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$",
    },
    role: { 
      type: 'string', 
      enum: ['Staff', 'Admin'] 
    }
  }
};
module.exports = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'email', 'password', 'phoneNumber', 'address', 'location', 'commissionRate'],
  properties: {
    name: { type: 'string', minLength: 1 },
    email: { type: 'string', format: 'email' },
    password: {
      type: 'string',
      minLength: 8,  
      pattern: "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$",
    },
    phoneNumber: { type: 'string', pattern: "^01[0125][0-9]{8}$" },
    address: { type: 'string', minLength: 1 },
    commissionRate: { type: 'number', minimum: 0, maximum: 100 }, 
    profileImage: { type: 'string', minLength: 1 }, // [جديد] صورة البروفايل للممرض
    location: {
      type: 'object',
      required: ['type', 'coordinates'],
      properties: {
        type: { const: 'Point' },
        coordinates: { type: 'array', minItems: 2, maxItems: 2, items: { type: 'number' } }
      }
    },
    services: { type: 'array', items: { type: 'string' } },
    experience: { type: 'string', minLength: 1 },
    offDays: { 
      type: 'array', 
      items: { 
        type: 'integer', 
        minimum: 0, 
        maximum: 6 
      } 
    }
  }
};
module.exports = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'email', 'password', 'role', 'phoneNumber'], // 1. أضف phoneNumber هنا
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
    },
    phoneNumber: { // 2. أضف قواعد التحقق لرقم التليفون
      type: 'string',
      pattern: "^01[0125][0-9]{8}$" // نمط رقم الهاتف المصري (اختياري، أو يمكنك جعله type: 'string' فقط)
    }
  }
};
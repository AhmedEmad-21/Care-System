module.exports = {
  type: "object",
  additionalProperties: false,
  required: ["name", "email", "password", "phoneNumber", "address", "location"], // تأكيد أن اللوكيشن إجباري بالتنسيق الصح
  properties: {
    role: { enum: ["Patient", "Doctor", "Nurse", "Staff", "Admin"] },
    name: { type: "string", minLength: 1 },
    email: { type: "string", format: "email" },
    password: {
      type: "string",
      minLength: 8,
      pattern: "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$",
    },
    phoneNumber: { type: "string", pattern: "^01[0125][0-9]{8}$" },
    address: { type: "string", minLength: 1 },
    profileImage: { type: "string", minLength: 1 },
    location: {
      type: "object",
      additionalProperties: false,
      required: ["type", "coordinates"],
      properties: {
        type: { const: "Point" },
        coordinates: {
          type: "array",
          minItems: 2,
          maxItems: 2,
          items: { type: "number" },
        },
      },
    },
  },
};
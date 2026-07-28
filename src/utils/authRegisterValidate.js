module.exports = {
  type: "object",
  additionalProperties: false,
  // تمت إزالة "role" من المصفوفة المطلوبة
  required: ["name", "email", "password", "phoneNumber", "address"],
  properties: {
    role: { enum: ["Patient", "Doctor", "Nurse", "Staff", "Admin"] },
    name: { type: "string", minLength: 1 },
    email: { type: "string", format: "email" },
    password: { type: "string", minLength: 8 },
    phoneNumber: { type: "string", pattern: "^01[0125][0-9]{8}$" },
    address: { type: "string" },
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
    specialization: { type: "string", minLength: 1 },
    basePrice: { type: "number", minimum: 0 },
    serviceName: { type: "string", minLength: 1 },
    workingHours: {
      type: "object",
      additionalProperties: false,
      properties: {
        start: { type: "string", minLength: 1 },
        end: { type: "string", minLength: 1 },
      },
    },
    offDays: {
      type: "array",
      items: { type: "integer", minimum: 0, maximum: 6 },
    },
  },
  allOf: [
    {
      if: { properties: { role: { const: "Doctor" } } },
      then: { required: ["location", "specialization", "basePrice"] },
    },
    {
      if: { properties: { role: { const: "Nurse" } } },
      then: { required: ["location"] },
    },
  ],
};
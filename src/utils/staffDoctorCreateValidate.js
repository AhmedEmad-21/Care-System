module.exports = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'email', 'password', 'phoneNumber', 'address', 'location', 'basePrice', 'specialization', 'commissionRate'],
  properties: {
    name: { type: 'string', minLength: 1 },
    email: { type: 'string', format: 'email' },
    password: {
      type: 'string',
      minLength: 8,
      pattern: "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$",
    },
    phoneNumber: { type: 'string', pattern: "^01[0125][0-9]{8}$" },
    secondaryPhoneNumber: { type: 'string', pattern: "^01[0125][0-9]{8}$" },
    address: { type: 'string', minLength: 1 },
    specialization: { 
      type: 'string', 
   enum: [
      'باطنة', 
      'أطفال وحديثي الولادة', 
      'أمراض النساء والتوليد وتأخر الإنجاب', 
      'العظام والمفاصل والعمود الفقري', 
      'القلب والأوعية الدموية', 
      'الصدر والجهاز التنفسي', 
      'المخ والأعصاب والطب النفسي', 
      'جهاز هضمي وكبد ومناظير', 
      'الأنف والأذن والحنجرة', 
      'الجلدية والتناسلية والتجميل', 
      'الرمد', 
      'الأسنان', 
      'الجراحة العامة وجراحة المناظير', 
      'الكلى والمسالك البولية', 
      'العلاج الطبيعي والتأهيل'
    ]
    },
    basePrice: { type: 'number', minimum: 0 },
    urgentPrice: { type: 'number', minimum: 0 }, // [جديد] الكشف المستعجل
    commissionRate: { type: 'number', minimum: 0, maximum: 100 }, 
    profileImage: { type: 'string', minLength: 1 },
    location: {
      type: 'object',
      required: ['type', 'coordinates'],
      properties: {
        type: { const: 'Point' },
        coordinates: { type: 'array', minItems: 2, maxItems: 2, items: { type: 'number' } }
      }
    },
    workingHours: {
      type: 'object',
      properties: { start: { type: 'string' }, end: { type: 'string' } }
    },
    offDays: { type: 'array', items: { type: 'integer', minimum: 0, maximum: 6 } }
  }
};
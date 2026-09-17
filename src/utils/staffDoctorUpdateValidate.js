module.exports = {
  type: 'object',
  additionalProperties: false,
  minProperties: 1,
  properties: {
    name: { type: 'string', minLength: 1 },
    email: { type: 'string', format: 'email' },
    phoneNumber: { type: 'string', pattern: '^01[0125][0-9]{8}$' },
    secondaryPhoneNumber: { type: 'string', pattern: '^01[0125][0-9]{8}$' },
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
    urgentPrice: { type: 'number', minimum: 0 },
    commissionRate: { type: 'number', minimum: 0, maximum: 100 },
    profileImage: { type: 'string', minLength: 1 },
    location: {
      type: 'object',
      additionalProperties: false,
      required: ['type', 'coordinates'],
      properties: {
        type: { const: 'Point' },
        coordinates: { type: 'array', minItems: 2, maxItems: 2, items: { type: 'number' } },
      },
    },
    workingHours: {
      type: 'object',
      additionalProperties: false,
      properties: {
        start: { type: 'string', minLength: 1 },
        end: { type: 'string', minLength: 1 },
      },
    },
    offDays: {
      type: 'array',
      items: { type: 'integer', minimum: 0, maximum: 6 },
    },
    isAvailable: { type: 'boolean' },
  },
};
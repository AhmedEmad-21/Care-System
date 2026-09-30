const Ajv = require('ajv').default;
const addFormats = require('ajv-formats');

const ajv = new Ajv({ allErrors: true, removeAdditional: true, useDefaults: true });
addFormats(ajv);

const fieldNameMap = {
  name: 'الاسم',
  email: 'البريد الإلكتروني',
  password: 'كلمة المرور',
  phoneNumber: 'رقم الهاتف الأساسي',
  secondaryPhoneNumber: 'رقم الهاتف الثانوي',
  address: 'العنوان',
  location: 'الموقع الجغرافي',
  role: 'نوع الحساب / الصلاحية',
  specialization: 'التخصص الطبي',
  basePrice: 'سعر الكشف الأساسي',
  urgentPrice: 'سعر الكشف المستعجل',
  commissionRate: 'نسبة العمولة',
  profileImage: 'الصورة الشخصية',
  workingHours: 'مواعيد العمل',
  offDays: 'أيام الإجازة',
  description: 'النبذة التعريفية',
  services: 'الخدمات',
  experience: 'الخبرة'
};

const formatAjvErrorToArabic = (err) => {
  const rawPath = (err.instancePath || err.dataPath || '').replace(/^\//, '');
  const path = rawPath.split('/')[0] || '';
  const fieldLabel = fieldNameMap[path] || (path ? `حقل (${path})` : '');

  if (err.keyword === 'required') {
    const missingField = err.params?.missingProperty;
    const label = fieldNameMap[missingField] || missingField;
    return `حقل (${label}) مطلوب`;
  }

  if (err.keyword === 'pattern') {
    if (path === 'password') {
      return 'كلمة المرور يجب أن تحتوي على 8 خانات على الأقل، وتتضمن حرفاً كبيراً (A-Z)، وحرفاً صغيراً (a-z)، ورقماً (0-9)، ورمزاً خاصاً (@$!%*?&#._-)';
    }
    if (path === 'phoneNumber' || path === 'secondaryPhoneNumber') {
      return `${fieldLabel} غير صالح، يجب أن يكون رقماً مصرياً مكوناً من 11 خانة يبدأ بـ (010, 011, 012, 015)`;
    }
    return `${fieldLabel} لا يتطابق مع النمط المطلوب`;
  }

  if (err.keyword === 'format' && err.params?.format === 'email') {
    return 'صيغة البريد الإلكتروني غير صحيحة';
  }

  if (err.keyword === 'minLength') {
    return `${fieldLabel} يجب ألا يقل عن ${err.params?.limit} أحرف`;
  }

  if (err.keyword === 'minimum') {
    return `${fieldLabel} يجب أن يكون ${err.params?.limit} أو أكثر`;
  }

  if (err.keyword === 'maximum') {
    return `${fieldLabel} يجب ألا يتجاوز ${err.params?.limit}`;
  }

  if (err.keyword === 'enum') {
    return `${fieldLabel} يجب أن يكون إحدى القيم المعتمدة: ${err.params?.allowedValues?.join(', ')}`;
  }

  if (err.keyword === 'additionalProperties') {
    return `حقل غير مصرح به: (${err.params?.additionalProperty})`;
  }

  return `${fieldLabel ? fieldLabel + ': ' : ''}${err.message}`;
};

module.exports = (schema) => {
  if (!schema) throw new Error('validateAjvMW requires a JSON schema');
  const validate = ajv.compile(schema);

  return (req, res, next) => {
    const data = req.body || {};
    const valid = validate(data);
    if (!valid) {
      const errors = (validate.errors || []).map((e) => ({
        path: e.instancePath || e.dataPath,
        message: formatAjvErrorToArabic(e),
        rawMessage: e.message
      }));
      const combinedMessage = errors.map((e) => e.message).join(' | ');
      return res.status(400).json({
        success: false,
        message: combinedMessage || 'فشل التحقق من صحة البيانات المدخلة',
        errors
      });
    }
    next();
  };
};
const { OpenAI } = require('openai');
const User = require('../models/userModel');
const { NotFoundError } = require('../errors/appErrors');

// تهيئة عميل Groq/OpenAI باستخدام متغيرات البيئة (.env)
const openai = new OpenAI({
  baseURL: 'https://api.groq.com/openai/v1',
  apiKey: process.env.AI_API_KEY,
});

// قائمة القواعد المحلية الاحترافية (Keyword-based Fallback Rules) للبيئة المصرية
const LOCAL_RULES = [
  {
    specialty: 'قلب وأوعية دموية',
    keywords: ['صداع شديد', 'ألم في الصدر', 'وجع في قلبي', 'ذبحة', 'ضغط', 'ضربات قلب', 'دوخة شديدة', 'إغماء', 'الصدر']
  },
  {
    specialty: 'عظام',
    keywords: ['كسر', 'وجع ظهر', 'ظهرى', 'ركبة', 'خشونة', 'المفاصل', 'المفصل', 'رقبة', 'كتف', 'العظم', 'روماتيزم', 'عرج']
  },
  {
    specialty: 'أطفال',
    keywords: ['طفل', 'رضيع', 'سخونية طفل', 'ابنى', 'بنتى', 'الحضانة', 'أطفال', 'التطعيم']
  },
  {
    specialty: 'نسا وتوليد',
    keywords: ['حمل', 'ولادة', 'دورة', 'تأخر حمل', 'مغض حمل', 'إجهاض', 'مبيض', 'الرحم', 'فترة الحيض']
  },
  {
    specialty: 'جهاز هضمي وكبد',
    keywords: ['الم بطن', 'مغص', 'اسهال', 'امساك', 'ترجيع', 'قولون', 'حموضة', 'حرقان', 'انتفاخ', 'كبد', 'مرارة', 'البطن']
  },
  {
    specialty: 'أنف وأذن وحنجرة',
    keywords: ['زور', 'زلاعيم', 'ودن', 'وداني', 'مناخير', 'جيوب انفية', 'سعال', 'رشح', 'صوتى', 'بلعوم', 'اللوز']
  },
  {
    specialty: 'جلدية',
    keywords: ['حساسية', 'حبوب', 'بقع', 'شعر', 'تساقط', 'جلد', 'حكة', 'هرش', 'ثعلبة', 'إكزيما', 'صدفية']
  },
  {
    specialty: 'رمد',
    keywords: ['عين', 'عيني', 'نظر', 'رؤية', 'زغللة', 'احمرار العين', 'الرموش', 'المية البيضاء']
  },
  {
    specialty: 'أسنان',
    keywords: ['ضرس', 'سن', 'أسنان', 'لثة', 'وجع فم', 'تبييض', 'تسوس', 'التهاب اللثة']
  },
  {
    specialty: 'مخ وأعصاب',
    keywords: ['صرع', 'تنميل', 'اعصاب', 'رعشة', 'باركنسون', 'شلل', 'ذاكرة', 'تخاطب', 'نوبات']
  },
  {
    specialty: 'نفسية',
    keywords: ['اكتئاب', 'قلق', 'توتر', 'وسواس', 'خوف', 'هلع', 'نوم', 'ارق', 'حالة نفسية', 'عصبية']
  },
  {
    specialty: 'صدرية',
    keywords: ['كحة', 'بلغم', 'تنفس', 'ضيق نفس', 'ربو', 'حساسية صدر', 'السعال', 'الرئة']
  }
];

// دالة التحليل المحلي الذكية والمصممة خصيصاً لتناسب الأعراض باللهجة المصرية
const inferLocally = (symptoms) => {
  if (!symptoms || typeof symptoms !== 'string') return 'طب عام';
  
  const text = symptoms.toLowerCase();

  for (const rule of LOCAL_RULES) {
    for (const keyword of rule.keywords) {
      if (text.includes(keyword.toLowerCase())) {
        console.log(`🛠️ Local Rules matched keyword: "${keyword}" -> Specialty: "${rule.specialty}"`);
        return rule.specialty;
      }
    }
  }

  // القيمة الافتراضية لو مفيش ولا كلمة مطابقة
  return 'طب عام';
};

const getSuggestedSpecialty = async (patientId, symptoms) => {
  const patient = await User.findById(patientId);
  if (!patient) throw new NotFoundError('Patient not found');

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.AI_MODEL || "llama-3.1-8b-instant",
      messages: [
        { 
          role: "system", 
          content: "أنت مساعد طبي ذكي خبير في النظام الصحي المصري. مهمتك هي تحليل أعراض المريض وتوجيهه لأدق تخصص طبي متاح في العيادات المصرية." 
        },
        { 
          role: "user", 
          content: `المريض يعاني من: "${symptoms}". 
          اختر التخصص الأنسب حصراً من القائمة التالية: 
          [باطنة, صدرية, نفسية, قلب وأوعية دموية, عظام, جلدية, رمد, أسنان, مخ وأعصاب, جهاز هضمي وكبد, أنف وأذن وحنجرة, جراحة عامة, نسا وتوليد, أطفال].
          القواعد:
          1. أجب باسم التخصص فقط دون أي مقدمات.
          2. إذا كانت الحالة طارئة أو متعلقة بجلطة/ألم صدر، اختر 'قلب وأوعية دموية' أو 'مخ وأعصاب' حسب الأعراض.
          3. لا تضف أي نص إضافي، كلمة واحدة فقط.`
        }
      ],
      max_tokens: 20,
    });

    const specialty = completion.choices[0].message.content.trim();
    console.log("✅ AI Analysis success! Suggested specialty:", specialty);
    return specialty;

  } catch (error) {
    console.error("❌ Groq Error (Falling back to local rules):", error.message);
    return inferLocally(symptoms);
  }
};

module.exports = { getSuggestedSpecialty, inferLocally };
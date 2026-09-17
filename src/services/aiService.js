const { OpenAI } = require('openai');
const User = require('../models/userModel');
const { NotFoundError, TooManyRequestsError, ServiceUnavailableError } = require('../errors/appErrors');

const MAX_DAILY_AI_ATTEMPTS = 4;

const isSameDay = (dateA, dateB) => {
  if (!dateA || !dateB) return false;
  const a = new Date(dateA);
  const b = new Date(dateB);

  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
};

const getDailyAiUsage = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw new NotFoundError('Patient not found');

  const today = new Date();
  const lastDate = user.lastAiAnalysisDate ? new Date(user.lastAiAnalysisDate) : null;

  if (!lastDate || !isSameDay(today, lastDate)) {
    user.aiAnalysisAttempts = 0;
    user.lastAiAnalysisDate = today;
    await user.save();
  }

  if (user.aiAnalysisAttempts >= MAX_DAILY_AI_ATTEMPTS) {
    throw new TooManyRequestsError('لقد وصلت إلى الحد اليومي لاستخدام الذكاء الاصطناعي (4 محاولات يوميًا). حاول مرة أخرى غدًا.');
  }

  return user;
};

const getOpenAIClient = () => {
  const apiKey = (process.env.AI_API_KEY || '').trim();
  return new OpenAI({
    baseURL: process.env.AI_BASE_URL || 'https://api.groq.com/openai/v1',
    apiKey,
  });
};

const classifySpecialtyFallback = (symptoms) => {
  const s = String(symptoms || '').toLowerCase();

  if (/قلب|صدرية|خفقان|نبض|شريان|ضغط مرتفع|ذبحة/.test(s)) return 'القلب والأوعية الدموية';
  if (/عظم|مفصل|كسر|ركبة|غضروف|ظهر|فقرات|التواء|عمود فقري/.test(s)) return 'العظام والمفاصل والعمود الفقري';
  if (/مغص|معدة|قولون|إسهال|امساك|ترجيع|قيء|كبد|مرارة|حموضة|هضم/.test(s)) return 'باطنة';
  if (/طفل|رضيع|مولود|سخونة طفل|تطعيم/.test(s)) return 'أطفال وحديثي الولادة';
  if (/حمل|ولادة|دورة|مبيض|رحم|جنين/.test(s)) return 'أمراض النساء والتوليد وتأخر الإنجاب';
  if (/تنفس|كحة|سعال|رئة|بلغم|ضيق تنفس|ربو|حساسية صدر/.test(s)) return 'الصدر والجهاز التنفسي';
  if (/مخ|أعصاب|صرع|شلل|تنميل|دوخة|صداع|نفسي|اكتئاب|قلق/.test(s)) return 'المخ والأعصاب والطب النفسي';
  if (/أنف|أذن|حنجرة|لوز|احتقان|جيوب أنفية|سمع/.test(s)) return 'الأنف والأذن والحنجرة';
  if (/جلد|حبوب|طفح|حكة|بهاق|صدفية|شعر|أكزيما/.test(s)) return 'الجلدية والتناسلية والتجميل';
  if (/عين|رمد|قرنية|شبكية|حول|رؤية|زغللة/.test(s)) return 'الرمد';
  if (/سنان|أسنان|ضرس|لثة|تقويم|حشو/.test(s)) return 'الأسنان';
  if (/كلى|مسالك|بول|حصوة|بروستاتا|حرقان بول/.test(s)) return 'الكلى والمسالك البولية';
  if (/علاج طبيعي|تأهيل|جلطة|تصلب/.test(s)) return 'العلاج الطبيعي والتأهيل';
  if (/جراحة|زائدة|ورم|فتق|بواسير|ناسور/.test(s)) return 'الجراحة العامة وجراحة المناظير';

  return 'باطنة';
};

const getSuggestedSpecialty = async (patientId, symptoms) => {
  const patient = await getDailyAiUsage(patientId);

  if (!symptoms || typeof symptoms !== 'string' || !symptoms.trim()) {
    throw new ServiceUnavailableError('Symptoms are required for AI analysis.');
  }

  try {
    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: process.env.AI_MODEL || 'openai/gpt-oss-120b',
      messages: [
        {
          role: 'system',
          content: 'أنت مساعد طبي احترافي وموثوق في النظام الصحي المصري. حلّل أعراض المريض بدقة وحدّد التخصص الطبي الأنسب من قائمة محددة فقط.',
        },
        {
          role: 'user',
          content: `المريض يعاني من: "${symptoms}".
          اختر التخصص الأنسب فقط من القائمة التالية:
          [باطنة, أطفال وحديثي الولادة, أمراض النساء والتوليد وتأخر الإنجاب, العظام والمفاصل والعمود الفقري, القلب والأوعية الدموية, الصدر والجهاز التنفسي, المخ والأعصاب والطب النفسي, جهاز هضمي وكبد ومناظير, الأنف والأذن والحنجرة, الجلدية والتناسلية والتجميل, الرمد, الأسنان, الجراحة العامة وجراحة المناظير, الكلى والمسالك البولية, العلاج الطبيعي والتأهيل].
          القواعد:
          1. أجب باسم التخصص فقط دون أي مقدمة أو شرح.
          2. إذا كانت الحالة طارئة أو متعلقة بالقلب أو المخ، اختر الصحيح من القائمة فقط.
          3. لا تضف أي نص إضافي، فقط اسم التخصص.`,
        },
      ],
      max_tokens: 600,
    });

    const specialty = completion.choices[0]?.message?.content?.trim();

    if (!specialty) {
      throw new ServiceUnavailableError('The AI provider returned an empty specialty result.');
    }

    patient.aiAnalysisAttempts += 1;
    patient.lastAiAnalysisDate = new Date();
    await patient.save();

    console.log('✅ AI Analysis success! Suggested specialty:', specialty);
    return specialty;
  } catch (error) {
    if (error instanceof TooManyRequestsError || error instanceof NotFoundError) {
      throw error;
    }

    console.error('⚠️ Groq AI API error, using smart medical fallback:', error.message);

    // استخدام المساعد الطبي الذكي كـ Fallback عند تعذر الاتصال بـ Groq أو خطأ في الـ API Key
    const fallbackSpecialty = classifySpecialtyFallback(symptoms);

    patient.aiAnalysisAttempts += 1;
    patient.lastAiAnalysisDate = new Date();
    await patient.save();

    console.log('ℹ️ Suggested specialty via medical fallback:', fallbackSpecialty);
    return fallbackSpecialty;
  }
};

module.exports = { getSuggestedSpecialty };
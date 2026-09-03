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

const openai = new OpenAI({
  baseURL: 'https://api.groq.com/openai/v1',
  apiKey: process.env.AI_API_KEY,
});

const getSuggestedSpecialty = async (patientId, symptoms) => {
  const patient = await getDailyAiUsage(patientId);

  if (!symptoms || typeof symptoms !== 'string' || !symptoms.trim()) {
    throw new ServiceUnavailableError('Symptoms are required for AI analysis.');
  }

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.AI_MODEL || 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content: 'أنت مساعد طبي احترافي وموثوق في النظام الصحي المصري. حلّل أعراض المريض بدقة وحدّد التخصص الطبي الأنسب من قائمة محددة فقط.',
        },
        {
          role: 'user',
          content: `المريض يعاني من: "${symptoms}".
          اختر التخصص الأنسب فقط من القائمة التالية:
          [باطنة, صدرية, نفسية, قلب وأوعية دموية, عظام, جلدية, رمد, أسنان, مخ وأعصاب, جهاز هضمي وكبد, أنف وأذن وحنجرة, جراحة عامة, نسا وتوليد, أطفال].
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

    // طباعة الخطأ كاملاً في التيرمنال لمعرفة السبب الدقيق
    console.error('❌ Groq API Full Error Details:', error.response ? error.response.data : error);
    
    // إرجاع تفاصيل الخطأ الحقيقي مباشرة لتبان عندك في الـ Response أو التيرمنال
    throw new ServiceUnavailableError(`AI Error: ${error.message}`);
  }
};

module.exports = { getSuggestedSpecialty };
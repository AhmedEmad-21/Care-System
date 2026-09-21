const Doctor = require('../models/doctorModel');
const AISession = require('../models/aiSessionModel');
const config = require('../config/appConfig');

const CANONICAL_SPECIALTIES = [
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
];

const SPECIALTY_RULES = [
  { keywords: ['chest', 'heart', 'pressure', 'cardio', 'صدر', 'قلب', 'نبض', 'خفقان'], specialty: 'القلب والأوعية الدموية', confidence: 0.93 },
  { keywords: ['skin', 'rash', 'allergy', 'itch', 'جلد', 'حبوب', 'هرش', 'طفح'], specialty: 'الجلدية والتناسلية والتجميل', confidence: 0.88 },
  { keywords: ['eye', 'vision', 'sight', 'عين', 'رمد', 'زغللة'], specialty: 'الرمد', confidence: 0.84 },
  { keywords: ['bone', 'joint', 'back', 'fracture', 'عظم', 'مفصل', 'ظهر', 'ركبة', 'كسر'], specialty: 'العظام والمفاصل والعمود الفقري', confidence: 0.87 },
  { keywords: ['fever', 'cough', 'cold', 'flu', 'مغص', 'معدة', 'بطن', 'سخونة'], specialty: 'باطنة', confidence: 0.71 },
];

const inferSpecialty = (symptoms) => {
  const normalized = String(symptoms || '').toLowerCase();
  const rule = SPECIALTY_RULES.find((entry) => entry.keywords.some((keyword) => normalized.includes(keyword)));
  return rule || { specialty: 'باطنة', confidence: 0.5 };
};

const SPECIALTY_ALIASES = [
  { aliases: ['general medicine', 'internal medicine', 'باطنة', 'باطنه', 'باطني'], canonical: 'باطنة' },
  { aliases: ['cardiology', 'cardio', 'heart', 'قلب', 'أمراض القلب', 'القلب والأوعية الدموية', 'اوعية دموية', 'أوعية دموية'], canonical: 'القلب والأوعية الدموية' },
  { aliases: ['dermatology', 'skin', 'جلدية', 'جلديه', 'الجلدية والتناسلية والتجميل', 'تناسلية', 'تجميل'], canonical: 'الجلدية والتناسلية والتجميل' },
  { aliases: ['ophthalmology', 'eye', 'عيون', 'رمد', 'الرمد'], canonical: 'الرمد' },
  { aliases: ['orthopedics', 'orthopedic', 'bone', 'joint', 'عظام', 'عظام ومفاصل', 'العظام والمفاصل والعمود الفقري', 'عمود فقري'], canonical: 'العظام والمفاصل والعمود الفقري' },
  { aliases: ['neurology', 'neuro', 'brain', 'psychiatry', 'مخ وأعصاب', 'مخ واعصاب', 'نفسي', 'المخ والأعصاب والطب النفسي'], canonical: 'المخ والأعصاب والطب النفسي' },
  { aliases: ['pediatrics', 'children', 'اطفال', 'أطفال', 'أطفال وحديثي الولادة', 'حديثي الولادة'], canonical: 'أطفال وحديثي الولادة' },
  { aliases: ['gynecology', 'obstetrics', 'نساء', 'نسائية', 'نساء وتوليد', 'أمراض النساء والتوليد وتأخر الإنجاب', 'تأخر الإنجاب'], canonical: 'أمراض النساء والتوليد وتأخر الإنجاب' },
  { aliases: ['pulmonology', 'chest', 'respiratory', 'صدر', 'جهاز تنفسي', 'الصدر والجهاز التنفسي'], canonical: 'الصدر والجهاز التنفسي' },
  { aliases: ['gastroenterology', 'gi', 'liver', 'endoscopy', 'جهاز هضمي', 'كبد', 'مناظير', 'جهاز هضمي وكبد ومناظير'], canonical: 'جهاز هضمي وكبد ومناظير' },
  { aliases: ['ent', 'ear', 'nose', 'throat', 'أنف وأذن', 'انف واذن', 'حنجرة', 'الأنف والأذن والحنجرة'], canonical: 'الأنف والأذن والحنجرة' },
  { aliases: ['dentistry', 'dental', 'teeth', 'أسنان', 'اسنان', 'سنان', 'الأسنان'], canonical: 'الأسنان' },
  { aliases: ['surgery', 'general surgery', 'جراحة', 'جراحة عامة', 'الجراحة العامة وجراحة المناظير'], canonical: 'الجراحة العامة وجراحة المناظير' },
  { aliases: ['urology', 'nephrology', 'كلى', 'مسالك', 'مسالك بولية', 'الكلى والمسالك البولية'], canonical: 'الكلى والمسالك البولية' },
  { aliases: ['physiotherapy', 'rehabilitation', 'علاج طبيعي', 'تأهيل', 'العلاج الطبيعي والتأهيل'], canonical: 'العلاج الطبيعي والتأهيل' }
];

const normalizeText = (value) => String(value || '').trim().toLowerCase();

const resolveCanonicalSpecialty = async (specialty) => {
  const requested = normalizeText(specialty);
  if (!requested) return 'باطنة';

  // 1. إذا كانت القيمة المطلوبة تطابق إحدى التخصصات المعتمدة الرسمية الـ 15 مباشرة
  const exactCanonical = CANONICAL_SPECIALTIES.find(
    (canon) => normalizeText(canon) === requested
  );
  if (exactCanonical) return exactCanonical;

  // 2. البحث في جدول المرادفات والأسماء البديلة (سواء إنجليزي أو عربي دارج)
  const aliasMatch = SPECIALTY_ALIASES.find((entry) => 
    entry.aliases.some((alias) => {
      const normAlias = normalizeText(alias);
      return requested === normAlias || requested.includes(normAlias) || normAlias.includes(requested);
    })
  );
  if (aliasMatch) {
    return aliasMatch.canonical;
  }

  // 3. التحقق من التخصصات المسجلة حالياً في قاعدة البيانات للأطباء كإجراء احتياطي
  try {
    const existingSpecialties = await Doctor.distinct('specialization');
    const existingNormalized = existingSpecialties.map((entry) => ({ raw: entry, normalized: normalizeText(entry) }));

    const exactDbMatch = existingNormalized.find((entry) => entry.normalized === requested);
    if (exactDbMatch) return exactDbMatch.raw;
  } catch (err) {
    // تجاهل خطأ الاتصال في حال كانت قاعدة البيانات غير متصلة
  }

  return 'باطنة';
};

const { getTodayDateString } = require('../utils/dateUtils');

const buildDoctorQuery = ({ specialty, coordinates, maxDistanceMeters }) => {
  const today = new Date();
  const todayDay = today.getDay();
  const todayStr = getTodayDateString(today);

  const query = {
    isAvailable: true,
    offDays: { $ne: todayDay },
    unavailableDates: { $ne: todayStr },
  };

  if (specialty) query.specialization = specialty;

  if (coordinates) {
    query.location = {
      $nearSphere: {
        $geometry: { type: 'Point', coordinates },
        $maxDistance: maxDistanceMeters || config.securityConfig.geoSearchRadiusMeters,
      },
    };
  }

  return query;
};

const findDoctorsForSpecialty = async ({ specialty, requestLocation, maxDistanceMeters, limit = 20 }) => {
  const coordinates = requestLocation?.coordinates || null;
  const canonicalSpecialty = await resolveCanonicalSpecialty(specialty);

  const query = buildDoctorQuery({
    specialty: canonicalSpecialty,
    coordinates,
    maxDistanceMeters,
  });

  const doctors = await Doctor.find(query).limit(limit).lean();
  const formattedDoctors = doctors.map((doc) => ({
    ...doc,
    description: doc.description || '',
  }));
  return { specialty: canonicalSpecialty, doctors: formattedDoctors };
};

const createAiSession = async ({ patientId, symptoms, requestLocation, maxDistanceMeters, suggestedSpecialty }) => {
  const inferred = suggestedSpecialty
    ? { specialty: suggestedSpecialty, confidence: 0.95 }
    : inferSpecialty(symptoms);
  const resolved = await resolveCanonicalSpecialty(inferred.specialty);
  const matched = await findDoctorsForSpecialty({
    specialty: resolved,
    requestLocation,
    maxDistanceMeters,
  });
  const matchedDoctors = matched.doctors;
  const session = await AISession.create({
    patientId,
    symptoms,
    suggestedSpecialty: resolved,
    confidence: inferred.confidence,
    matchedDoctorIds: matchedDoctors.map((doctor) => doctor._id),
  });

  return {
    session,
    specialty: resolved,
    confidence: inferred.confidence,
    doctors: matchedDoctors,
  };
};

const findMatchingDoctors = async ({ symptoms, requestLocation, maxDistanceMeters }) => {
  const inferred = inferSpecialty(symptoms);
  const matched = await findDoctorsForSpecialty({
    specialty: inferred.specialty,
    requestLocation,
    maxDistanceMeters,
  });

  return {
    specialty: matched.specialty,
    confidence: inferred.confidence,
    doctors: matched.doctors,
  };
};

// دالة جلب الأطباء البدلاء مع الترتيب الجغرافي (الأقرب للأبعد) واستبعاد الدكتور غير المتاح
const getAlternativeDoctors = async ({ sessionId, excludedDoctorId, requestLocation, appointmentDate, specialty }) => {
  const session = sessionId ? await AISession.findById(sessionId) : null;
  const targetDate = appointmentDate ? new Date(appointmentDate) : new Date();
  const dayOfWeek = targetDate.getDay();
  const targetDateStr = getTodayDateString(targetDate);
  
  let doctorIdsFilter = session ? { _id: { $in: session.matchedDoctorIds, $ne: excludedDoctorId } } : { _id: { $ne: excludedDoctorId } };

  if (specialty && !session) {
    const resolvedSpecialty = await resolveCanonicalSpecialty(specialty);
    doctorIdsFilter.specialization = resolvedSpecialty;
  }

  // إذا توفر موقع المريض، نقوم بالترتيب الجغرافي باستخدام $geoNear
  if (requestLocation && requestLocation.coordinates) {
    const results = await Doctor.aggregate([
      {
        $geoNear: {
          near: { type: "Point", coordinates: requestLocation.coordinates },
          distanceField: "dist.calculated",
          spherical: true,
          query: {
            ...doctorIdsFilter,
            isAvailable: true,
            offDays: { $ne: dayOfWeek },
            unavailableDates: { $ne: targetDateStr }
          }
        }
      }
    ]);
    return results;
  } else {
    // الطريقة العادية في حال عدم توفر الإحداثيات
    return await Doctor.find({
      ...doctorIdsFilter,
      isAvailable: true,
      offDays: { $ne: dayOfWeek },
      unavailableDates: { $ne: targetDateStr }
    }).lean();
  }
};

module.exports = {
  CANONICAL_SPECIALTIES,
  inferSpecialty,
  resolveCanonicalSpecialty,
  findDoctorsForSpecialty,
  createAiSession,
  findMatchingDoctors,
  getAlternativeDoctors,
};
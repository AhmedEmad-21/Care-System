const Doctor = require('../models/doctorModel');
const AISession = require('../models/aiSessionModel');
const config = require('../config/appConfig');

const SPECIALTY_RULES = [
  { keywords: ['chest', 'heart', 'pressure', 'cardio'], specialty: 'Cardiology', confidence: 0.93 },
  { keywords: ['skin', 'rash', 'allergy', 'itch'], specialty: 'Dermatology', confidence: 0.88 },
  { keywords: ['eye', 'vision', 'sight'], specialty: 'Ophthalmology', confidence: 0.84 },
  { keywords: ['bone', 'joint', 'back', 'fracture'], specialty: 'Orthopedics', confidence: 0.87 },
  { keywords: ['fever', 'cough', 'cold', 'flu'], specialty: 'Internal Medicine', confidence: 0.71 },
];

const inferSpecialty = (symptoms) => {
  const normalized = String(symptoms || '').toLowerCase();
  const rule = SPECIALTY_RULES.find((entry) => entry.keywords.some((keyword) => normalized.includes(keyword)));
  return rule || { specialty: 'General Medicine', confidence: 0.5 };
};

const SPECIALTY_ALIASES = [
  { aliases: ['general medicine', 'internal medicine', 'باطنة', 'باطنه'], canonical: 'General Medicine' },
  { aliases: ['cardiology', 'cardio', 'قلب', 'أمراض القلب', 'امراض القلب'], canonical: 'Cardiology' },
  { aliases: ['dermatology', 'skin', 'جلدية', 'جلديه'], canonical: 'Dermatology' },
  { aliases: ['ophthalmology', 'eye', 'عيون'], canonical: 'Ophthalmology' },
  { aliases: ['orthopedics', 'orthopedic', 'bone', 'joint', 'عظام', 'عظام ومفاصل'], canonical: 'Orthopedics' },
  { aliases: ['neurology', 'neuro', 'brain', 'مخ وأعصاب', 'مخ واعصاب'], canonical: 'Neurology' },
  { aliases: ['pediatrics', 'children', 'اطفال', 'أطفال'], canonical: 'Pediatrics' },
  { aliases: ['gynecology', 'obstetrics', 'نساء', 'نسائية', 'نساء وتوليد'], canonical: 'Gynecology' },
];

const normalizeText = (value) => String(value || '').trim().toLowerCase();

const resolveCanonicalSpecialty = async (specialty) => {
  const requested = normalizeText(specialty);
  if (!requested) return 'General Medicine';

  const existingSpecialties = await Doctor.distinct('specialization');
  const existingNormalized = existingSpecialties.map((entry) => ({ raw: entry, normalized: normalizeText(entry) }));

  const exactMatch = existingNormalized.find((entry) => entry.normalized === requested);
  if (exactMatch) return exactMatch.raw;

  const aliasMatch = SPECIALTY_ALIASES.find((entry) => entry.aliases.some((alias) => requested === normalizeText(alias) || requested.includes(normalizeText(alias))));
  if (aliasMatch) {
    const canonicalExisting = existingNormalized.find((entry) => entry.normalized === normalizeText(aliasMatch.canonical));
    return canonicalExisting?.raw || aliasMatch.canonical;
  }

  return aliasMatch?.canonical || 'General Medicine';
};

const buildDoctorQuery = ({ specialty, coordinates, maxDistanceMeters }) => {
  const query = {
    isAvailable: true,
    offDays: { $ne: new Date().getDay() },
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
  return { specialty: canonicalSpecialty, doctors };
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
  const dayOfWeek = appointmentDate ? new Date(appointmentDate).getDay() : new Date().getDay();
  
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
            offDays: { $ne: dayOfWeek }
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
      offDays: { $ne: dayOfWeek }
    }).lean();
  }
};

module.exports = {
  inferSpecialty,
  resolveCanonicalSpecialty,
  findDoctorsForSpecialty,
  createAiSession,
  findMatchingDoctors,
  getAlternativeDoctors,
};
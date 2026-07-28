const asyncHandler = require('../utils/asyncHandler');
const aiService = require('../services/aiService');
const { createAiSession, findMatchingDoctors, getAlternativeDoctors } = require('../services/matchingService');
const Doctor = require('../models/doctorModel');

const specialtyMap = {
  "Cardiology": "قلب",
  "Dermatology": "جلدية",
  "Ophthalmology": "عيون",
  "Orthopedics": "عظام",
  "Internal Medicine": "باطنة",
  "Dentistry": "أسنان",
  "Gastroenterology": "باطنة"
};

const formatDistance = (kilometers) => {
  if (!Number.isFinite(kilometers)) return null;
  return kilometers < 1 ? `${Math.round(kilometers * 1000)}m` : `${kilometers.toFixed(1)}km`;
};

const analyzeSymptoms = asyncHandler(async (req, res) => {
  const { symptoms, requestLocation, appointmentDate } = req.body;
  const patientId = req.user.id || req.user._id;
  const userCoordinates = requestLocation?.coordinates || req.user.location?.coordinates;

  if (!symptoms || !appointmentDate) {
    return res.status(400).json({ success: false, message: 'Symptoms and appointment date are required' });
  }

  const dayOfWeek = new Date(appointmentDate).getDay();
  const aiSpecialty = await aiService.getSuggestedSpecialty(patientId, symptoms);
  const arabicSpecialty = specialtyMap[aiSpecialty] || aiSpecialty;

  const doctors = await Doctor.aggregate([
    {
      $geoNear: {
        near: { type: "Point", coordinates: userCoordinates },
        distanceField: "dist.calculated",
        spherical: true,
        query: { 
          specialization: arabicSpecialty, 
          isAvailable: true,
          offDays: { $ne: dayOfWeek }
        }
      }
    }
  ]);

  const doctorsFound = doctors.map((doc) => ({
    id: doc._id,
    name: doc.name,
    specialization: doc.specialization,
    distance: formatDistance(doc.dist.calculated / 1000),
    isAvailable: doc.isAvailable,
    basePrice: doc.basePrice,
  }));

  // حفظ الجلسة واستخراج الـ sessionId
  const sessionResult = await createAiSession({
    patientId,
    symptoms,
    suggestedSpecialty: arabicSpecialty,
    requestLocation: { type: "Point", coordinates: userCoordinates }
  });

  return res.status(200).json({
    success: true,
    sessionId: sessionResult.session._id, // <--- إرجاع الـ sessionId للفرونت إند
    suggestedSpecialty: arabicSpecialty,
    doctorsFound,
  });
});

const getAlternatives = asyncHandler(async (req, res) => {
  const { sessionId, excludedDoctorId, specialty, appointmentDate } = req.query;
  const requestLocation = req.body.requestLocation || req.user?.location;

  let alternativeDoctors = await getAlternativeDoctors({ 
    sessionId, 
    excludedDoctorId, 
    specialty,
    requestLocation,
    appointmentDate
  });

  const formattedAlternatives = alternativeDoctors.map((doc) => ({
    id: doc._id,
    name: doc.name,
    specialization: doc.specialization,
    distance: doc.dist?.calculated ? formatDistance(doc.dist.calculated / 1000) : null,
    isAvailable: doc.isAvailable,
    basePrice: doc.basePrice,
  }));

  return res.status(200).json({
    success: true,
    doctorsFound: formattedAlternatives
  });
});

const suggest = asyncHandler(async (req, res) => {
  const result = await findMatchingDoctors({
    symptoms: req.body.symptoms,
    requestLocation: req.body.requestLocation,
    maxDistanceMeters: req.body.maxDistanceMeters,
  });

  return res.json({ success: true, data: result });
});

module.exports = { analyzeSymptoms, getAlternatives, suggest };
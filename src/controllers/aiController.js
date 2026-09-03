const asyncHandler = require('../utils/asyncHandler');
const aiService = require('../services/aiService');
const User = require('../models/userModel');
const { createAiSession, findMatchingDoctors, getAlternativeDoctors, resolveCanonicalSpecialty } = require('../services/matchingService');
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

const resolveSearchCoordinates = async (req, patientId) => {
  const requestLocation = req.body?.requestLocation || req.body?.location;
  const incomingCoordinates = requestLocation?.coordinates || req.body?.coordinates;

  if (Array.isArray(incomingCoordinates) && incomingCoordinates.length >= 2) {
    return { type: 'Point', coordinates: [Number(incomingCoordinates[0]), Number(incomingCoordinates[1])] };
  }

  const user = await User.findById(patientId).select('location');
  const userCoordinates = user?.location?.coordinates;
  if (Array.isArray(userCoordinates) && userCoordinates.length >= 2) {
    return { type: 'Point', coordinates: [Number(userCoordinates[0]), Number(userCoordinates[1])] };
  }

  return null;
};

const analyzeSymptoms = asyncHandler(async (req, res) => {
  const { symptoms, appointmentDate, requestLocation } = req.body;
  const patientId = req.user.id || req.user._id;

  if (!symptoms || !String(symptoms).trim()) {
    return res.status(400).json({
      success: false,
      message: 'Symptoms are required',
    });
  }

  const aiSpecialty = await aiService.getSuggestedSpecialty(patientId, symptoms);
  const arabicSpecialty = specialtyMap[aiSpecialty] || aiSpecialty;
  const location = requestLocation?.coordinates || (req.user?.location?.coordinates ?? null);

  const sessionResult = await createAiSession({
    patientId,
    symptoms,
    suggestedSpecialty: arabicSpecialty,
    requestLocation: location ? { type: 'Point', coordinates: location } : null,
    appointmentDate,
  });

  return res.status(200).json({
    success: true,
    sessionId: sessionResult.session._id,
    suggestedSpecialty: sessionResult.specialty || arabicSpecialty,
    confidence: sessionResult.confidence || 0.95,
    message: 'Specialty analyzed successfully',
  });
});

const searchDoctors = asyncHandler(async (req, res) => {
  const patientId = req.user.id || req.user._id;
  const { specialty, appointmentDate, requestLocation, maxDistanceMeters } = req.body;

  if (!specialty || !String(specialty).trim()) {
    return res.status(400).json({
      success: false,
      message: 'specialty is required',
    });
  }

  const coords = requestLocation?.coordinates || await resolveSearchCoordinates(req, patientId);
  if (!coords || !Array.isArray(coords.coordinates) || coords.coordinates.length < 2) {
    return res.status(400).json({
      success: false,
      message: 'Valid requestLocation or user.location coordinates are required',
    });
  }

  const targetDay = appointmentDate ? new Date(appointmentDate).getDay() : new Date().getDay();
  const normalizedSpecialty = await resolveCanonicalSpecialty(specialty);

  const doctors = await Doctor.aggregate([
    {
      $geoNear: {
        near: { type: 'Point', coordinates: coords.coordinates },
        distanceField: 'dist.calculated',
        spherical: true,
        query: {
          specialization: normalizedSpecialty,
          isAvailable: true,
          offDays: { $ne: targetDay },
        },
      },
    },
  ]);

  const doctorsFound = doctors.map((doc) => ({
    id: doc._id,
    name: doc.name,
    specialization: doc.specialization,
    distance: doc.dist?.calculated ? formatDistance(doc.dist.calculated / 1000) : null,
    basePrice: doc.basePrice,
    rating: doc.rating || null,
    isAvailable: doc.isAvailable,
  }));

  return res.status(200).json({
    success: true,
    data: {
      specialty: normalizedSpecialty,
      appointmentDate: appointmentDate || null,
      requestedLocation: coords,
      doctorsFound,
    },
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

module.exports = { analyzeSymptoms, searchDoctors, getAlternatives, suggest };
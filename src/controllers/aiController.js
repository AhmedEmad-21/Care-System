const asyncHandler = require('../utils/asyncHandler');
const aiService = require('../services/aiService');
const { createAiSession, findMatchingDoctors, getAlternativeDoctors, resolveCanonicalSpecialty } = require('../services/matchingService');
const Doctor = require('../models/doctorModel');

const formatDistance = (kilometers) => {
  if (!Number.isFinite(kilometers)) return null;
  return kilometers < 1 ? `${Math.round(kilometers * 1000)}m` : `${kilometers.toFixed(1)}km`;
};

const analyzeSymptoms = asyncHandler(async (req, res) => {
  const { symptoms } = req.body;
  const patientId = req.user.id || req.user._id;

  if (!symptoms || !String(symptoms).trim()) {
    return res.status(400).json({
      success: false,
      message: 'Symptoms are required',
    });
  }

  const suggestedSpecialty = await aiService.getSuggestedSpecialty(patientId, symptoms);

  const sessionResult = await createAiSession({
    patientId,
    symptoms,
    suggestedSpecialty,
    requestLocation: null,
    appointmentDate: null,
  });

  return res.status(200).json({
    success: true,
    sessionId: sessionResult.session._id,
    suggestedSpecialty: sessionResult.specialty || suggestedSpecialty,
  });
});

const searchDoctors = asyncHandler(async (req, res) => {
  const { specialty, appointmentDate, requestLocation, maxDistanceMeters } = req.body;

  if (!specialty || !String(specialty).trim()) {
    return res.status(400).json({
      success: false,
      message: 'specialty is required',
    });
  }

  if (!requestLocation?.coordinates || !Array.isArray(requestLocation.coordinates) || requestLocation.coordinates.length < 2) {
    return res.status(400).json({
      success: false,
      message: 'Valid requestLocation.coordinates are required',
    });
  }

  const targetDay = appointmentDate ? new Date(appointmentDate).getDay() : new Date().getDay();
  const normalizedSpecialty = await resolveCanonicalSpecialty(specialty);

  const doctors = await Doctor.aggregate([
    {
      $geoNear: {
        near: { type: 'Point', coordinates: requestLocation.coordinates },
        distanceField: 'dist.calculated',
        spherical: true,
        maxDistance: Number(maxDistanceMeters) || 40000,
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
      requestLocation,
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
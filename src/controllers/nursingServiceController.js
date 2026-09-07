const asyncHandler = require('../utils/asyncHandler');
const NursingService = require('../models/nursingServiceModel');
const { createNursingBooking } = require('../services/bookingService');
const { buildNameFilter } = require('../utils/nameSearch');

const list = asyncHandler(async (req, res) => {
  const services = await NursingService.find({ isActive: true }).lean();
  return res.json({ success: true, data: services });
});

const searchByName = asyncHandler(async (req, res) => {
  const nameFilter = buildNameFilter(req.query.name);

  if (!nameFilter) {
    return res.status(400).json({
      success: false,
      message: 'يرجى إدخال اسم الخدمة للبحث عنها'
    });
  }

  const services = await NursingService.find({
    isActive: true,
    ...nameFilter
  }).lean();

  return res.json({
    success: true,
    count: services.length,
    data: services
  });
});

const detail = asyncHandler(async (req, res) => {
  const service = await NursingService.findById(req.params.id).lean();
  return res.json({ success: true, data: service });
});

const book = asyncHandler(async (req, res) => {
  const booking = await createNursingBooking({
    patientId: req.user.id || req.user._id,
    nurseId: req.body.nurseId,
    serviceId: req.body.serviceId,
    requestLocation: req.body.requestLocation,
    appointmentTime: req.body.appointmentTime,
  });

  return res.status(201).json({ success: true, data: booking });
});
const findNearestNurses = asyncHandler(async (req, res) => {
  const { serviceId, longitude, latitude } = req.query;
  const nurses = await findNursesForService({ 
    serviceId, 
    requestLocation: { coordinates: [parseFloat(longitude), parseFloat(latitude)] } 
  });
  res.json({ success: true, data: nurses });
});

module.exports = { list, detail, searchByName, book, findNearestNurses };
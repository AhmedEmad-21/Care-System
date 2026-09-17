const asyncHandler = require('../utils/asyncHandler');
const Booking = require('../models/bookingModel');
const NursingBooking = require('../models/nursingBookingModel');
const { createDoctorBooking, createNursingBooking } = require('../services/bookingService');

const createDoctorBookingHandler = asyncHandler(async (req, res) => {
  const patientId = req.user.id || req.user._id;

  const booking = await createDoctorBooking({
    ...req.body,
    patientId: patientId
  });

  return res.status(201).json({ success: true, data: booking });
});

const createNursingBookingHandler = asyncHandler(async (req, res) => {
  const patientId = req.user.id || req.user._id;
  
  const booking = await createNursingBooking({
    ...req.body,
    patientId
  });

  return res.status(201).json({ success: true, data: booking });
});

const myBookings = asyncHandler(async (req, res) => {
  const patientId = req.user.id || req.user._id;
  
  const [doctorBookings, nursingBookings] = await Promise.all([
    Booking.find({ patientId })
      .populate('doctorId', 'name specialization basePrice profileImage rating totalReviews')
      .populate('nurseId', 'name phoneNumber profileImage rating totalReviews')
      .lean(), // إرجاع Plain JSON بحل مشكلة الـ raw documents
      
    NursingBooking.find({ patientId })
      .populate('nurseId', 'name phoneNumber profileImage rating totalReviews')
      .populate('serviceId', 'name description basePrice')
      .lean() // إرجاع Plain JSON بحل مشكلة الـ raw documents
  ]);

  return res.json({ success: true, data: { doctorBookings, nursingBookings } });
});

const getBookingByIdHandler = asyncHandler(async (req, res) => {
  const patientId = req.user.id || req.user._id;
  const { id } = req.params;

  let booking = await Booking.findOne({ _id: id, patientId })
    .populate('doctorId', 'name specialization basePrice profileImage rating totalReviews address phoneNumber')
    .populate('nurseId', 'name phoneNumber profileImage rating totalReviews')
    .lean();

  let type = 'doctor';

  if (!booking) {
    booking = await NursingBooking.findOne({ _id: id, patientId })
      .populate('nurseId', 'name phoneNumber profileImage rating totalReviews address')
      .populate('serviceId', 'name description basePrice')
      .lean();
    type = 'nursing';
  }

  if (!booking) {
    return res.status(404).json({ success: false, message: 'الحجز غير موجود أو لا تملك صلاحية للوصول إليه' });
  }

  return res.json({ success: true, data: { ...booking, bookingType: type } });
});

module.exports = { 
  createDoctorBookingHandler, 
  createNursingBookingHandler, 
  myBookings,
  getBookingByIdHandler
};
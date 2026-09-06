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

module.exports = { 
  createDoctorBookingHandler, 
  createNursingBookingHandler, 
  myBookings 
};
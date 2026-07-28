const asyncHandler = require('../utils/asyncHandler');
const Booking = require('../models/bookingModel');
const NursingBooking = require('../models/nursingBookingModel');
const { createDoctorBooking, createNursingBooking } = require('../services/bookingService');

const createDoctorBookingHandler = asyncHandler(async (req, res) => {
  // استخراج الـ ID الخاص بالمريض من الـ Token الذي وضعه الـ authMiddleware
  const patientId = req.user.id || req.user._id;

  // دمج الـ patientId مع البيانات القادمة من الـ Body
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
    Booking.find({ patientId }), 
    NursingBooking.find({ patientId })
  ]);
  return res.json({ success: true, data: { doctorBookings, nursingBookings } });
});


module.exports = { createDoctorBookingHandler, createNursingBookingHandler, myBookings};
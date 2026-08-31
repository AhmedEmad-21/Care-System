const Booking = require('../models/bookingModel');
const NursingBooking = require('../models/nursingBookingModel');
const Doctor = require('../models/doctorModel');
const Nurse = require('../models/nurseModel');
const User = require('../models/userModel');
const { BadRequestError, NotFoundError } = require('../errors/appErrors');
const { BOOKING_STATUSES } = require('../config/constants');
const { logAuditEvent } = require('./auditLogService');
const { normalizeGeoPoint } = require('../utils/geoPoint');

const resolveBookingPrice = async ({ doctorId, nurseId }) => {
  if (doctorId) {
    const doctor = await Doctor.findById(doctorId).lean();
    if (!doctor) throw new NotFoundError('Doctor not found');
    return doctor.basePrice || doctor.baseVisitPrice || 0;
  }

  if (nurseId) {
    const nurse = await Nurse.findById(nurseId).lean();
    if (!nurse) throw new NotFoundError('Nurse not found');
    return nurse.servicePrice || 0;
  }

  throw new BadRequestError('doctorId or nurseId is required');
};

const createDoctorBooking = async ({ patientId, doctorId, nurseId, symptoms, requestLocation, appointmentTime, suggestedSpecialty }) => {
  if (!doctorId && !nurseId) {
    throw new BadRequestError('doctorId or nurseId is required');
  }

  const totalCost = await resolveBookingPrice({ doctorId, nurseId });

  // جلب اللوكيشن المسجل لليوزر تلقائياً لو الفرونت مابعتهوش
  let finalLocation = requestLocation;
  if (!finalLocation || !finalLocation.coordinates) {
    const user = await User.findById(patientId).lean();
    if (user && user.location) {
      finalLocation = user.location;
    }
  }

  return Booking.create({
    patientId,
    doctorId: doctorId || null,
    nurseId: nurseId || null,
    symptoms,
    suggestedSpecialty: suggestedSpecialty || null,
    requestLocation: normalizeGeoPoint(finalLocation, 'requestLocation'),
    appointmentTime: appointmentTime || null,
    totalCost,
    status: BOOKING_STATUSES.PENDING,
  });
};

const createNursingBooking = async ({ patientId, nurseId, serviceId, requestLocation, appointmentTime }) => {
  const nurse = await Nurse.findById(nurseId).lean();
  if (!nurse) throw new NotFoundError('Nurse not found');

  // جلب اللوكيشن المسجل لليوزر تلقائياً لو الفرونت مابعتهوش
  let finalLocation = requestLocation;
  if (!finalLocation || !finalLocation.coordinates) {
    const user = await User.findById(patientId).lean();
    if (user && user.location) {
      finalLocation = user.location;
    }
  }

  if (!finalLocation || !finalLocation.coordinates) {
    throw new BadRequestError('مطلوب تحديد الموقع لإرسال الممرض ولا يوجد موقع مسجل للحساب');
  }

  return NursingBooking.create({
    patientId,
    nurseId,
    serviceId,
    requestLocation: normalizeGeoPoint(finalLocation, 'requestLocation'),
    appointmentTime: appointmentTime || null,
    totalCost: nurse.servicePrice || 0,
    status: BOOKING_STATUSES.PENDING,
  });
};

const listPendingBookings = async ({ limit = 50 } = {}) => {
  return Booking.find({ status: BOOKING_STATUSES.PENDING })
    .populate('patientId', 'name phoneNumber')
    .populate('nurseId', 'name phoneNumber')
    .populate('serviceId', 'name description basePrice')
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

const updateBookingStatus = async ({ bookingId, status, appointmentTime, staffNote, confirmedByStaffId }) => {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw new NotFoundError('Booking not found');

  const before = booking.toObject();

  if (status) {
    booking.status = status;
  }

  if (appointmentTime) {
    booking.appointmentTime = appointmentTime;
  }

  if (staffNote !== undefined) {
    booking.staffNote = staffNote;
  }

  if (confirmedByStaffId) {
    booking.confirmedByStaffId = confirmedByStaffId;
  }

  await booking.save();

  await logAuditEvent({
    actorId: confirmedByStaffId || null,
    actorRole: 'Staff',
    action: 'BOOKING_STATUS_CHANGED',
    entityType: 'Booking',
    entityId: booking._id,
    before,
    after: booking.toObject(),
    meta: { status, appointmentTime, staffNote },
  });

  return booking;
};

const cancelBooking = async ({ bookingId, staffNote, confirmedByStaffId }) => updateBookingStatus({
  bookingId,
  status: BOOKING_STATUSES.CANCELLED,
  staffNote,
  confirmedByStaffId,
});

module.exports = {
  createDoctorBooking,
  createNursingBooking,
  listPendingBookings,
  updateBookingStatus,
  cancelBooking,
};
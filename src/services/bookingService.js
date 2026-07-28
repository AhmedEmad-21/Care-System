const Booking = require('../models/bookingModel');
const NursingBooking = require('../models/nursingBookingModel');
const Doctor = require('../models/doctorModel');
const Nurse = require('../models/nurseModel');
const { BadRequestError, NotFoundError } = require('../errors/appErrors');
const { BOOKING_STATUSES } = require('../config/constants');
const { logAuditEvent } = require('./auditLogService');

// تعديل الدالة لتقبل القيمة null دون إحداث خطأ
const normalizeGeoPoint = (location) => {
  if (!location) return null; // إذا لم يوجد موقع، نرجع null ببساطة
  
  if (location.type !== 'Point' || !Array.isArray(location.coordinates) || location.coordinates.length !== 2) {
    throw new BadRequestError('requestLocation must be a GeoJSON Point with [longitude, latitude]');
  }

  const coordinates = location.coordinates.map(Number);
  if (coordinates.some((entry) => !Number.isFinite(entry))) {
    throw new BadRequestError('requestLocation contains invalid coordinates');
  }

  return { type: 'Point', coordinates };
};

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

  return Booking.create({
    patientId,
    doctorId: doctorId || null,
    nurseId: nurseId || null,
    symptoms,
    suggestedSpecialty: suggestedSpecialty || null,
    requestLocation: normalizeGeoPoint(requestLocation), // الآن تعمل حتى لو كانت null
    appointmentTime: appointmentTime || null,
    totalCost,
    status: BOOKING_STATUSES.PENDING,
  });
};

const createNursingBooking = async ({ patientId, nurseId, serviceId, requestLocation, appointmentTime }) => {
  // التحقق من الموقع (كما اتفقنا)
  if (!requestLocation || !requestLocation.coordinates) {
    throw new BadRequestError('مطلوب تحديد الموقع لإرسال الممرض');
  }

  const nurse = await Nurse.findById(nurseId).lean();
  if (!nurse) throw new NotFoundError('Nurse not found');

  // حفظ الطلب مع الـ serviceId
  return NursingBooking.create({
    patientId,
    nurseId,
    serviceId, // <--- هنا ستحفظ الخدمة التي اختارها المريض
    requestLocation: normalizeGeoPoint(requestLocation),
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
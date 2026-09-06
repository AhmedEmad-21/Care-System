const Booking = require('../models/bookingModel');
const NursingBooking = require('../models/nursingBookingModel');
const Doctor = require('../models/doctorModel');
const Nurse = require('../models/nurseModel');
const User = require('../models/userModel');
const { BadRequestError, NotFoundError } = require('../errors/appErrors');
const { BOOKING_STATUSES } = require('../config/constants');
const { logAuditEvent } = require('./auditLogService');
const { normalizeGeoPoint } = require('../utils/geoPoint');
const { sendNotificationToUser } = require('./notificationService');

const ACTIVE_BOOKING_STATUSES = [BOOKING_STATUSES.PENDING, BOOKING_STATUSES.CONFIRMED];

const getDayBounds = (appointmentTime) => {
  const appointmentDate = new Date(appointmentTime);
  const start = new Date(appointmentDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return { start, end };
};

const assertNoDuplicateProviderBooking = async ({ patientId, providerField, providerId, providerLabel }) => {
  const duplicateBooking = await Booking.findOne({
    patientId,
    [providerField]: providerId,
    status: { $in: ACTIVE_BOOKING_STATUSES },
  }).lean();

  const duplicateNursingBooking = await NursingBooking.findOne({
    patientId,
    [providerField]: providerId,
    status: { $in: ACTIVE_BOOKING_STATUSES },
  }).lean();

  if (duplicateBooking || duplicateNursingBooking) {
    throw new BadRequestError(`لديك طلب حجز قيد الانتظار أو مؤكد بالفعل مع هذا المزود (${providerLabel})`);
  }
};

const assertNoSameDayBooking = async ({ patientId, appointmentTime }) => {
  const { start, end } = getDayBounds(appointmentTime);

  const bookingOnSameDay = await Booking.findOne({
    patientId,
    status: { $in: ACTIVE_BOOKING_STATUSES },
    appointmentTime: { $gte: start, $lt: end },
  }).lean();

  const nursingBookingOnSameDay = await NursingBooking.findOne({
    patientId,
    status: { $in: ACTIVE_BOOKING_STATUSES },
    appointmentTime: { $gte: start, $lt: end },
  }).lean();

  if (bookingOnSameDay || nursingBookingOnSameDay) {
    throw new BadRequestError('لا يمكنك حجز أكثر من موعد في نفس اليوم');
  }
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

  const providerField = doctorId ? 'doctorId' : 'nurseId';
  const providerId = doctorId || nurseId;
  const providerLabel = doctorId ? 'Doctor' : 'Nurse';

  await assertNoDuplicateProviderBooking({
    patientId,
    providerField,
    providerId,
    providerLabel,
  });

  await assertNoSameDayBooking({
    patientId,
    appointmentTime,
  });

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

  await assertNoDuplicateProviderBooking({
    patientId,
    providerField: 'nurseId',
    providerId: nurseId,
    providerLabel: 'Nurse',
  });

  await assertNoSameDayBooking({
    patientId,
    appointmentTime,
  });

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

  const providerLabel = booking.doctorId ? 'Doctor' : booking.nurseId ? 'Nurse' : 'Provider';
  const notificationTitleMap = {
    [BOOKING_STATUSES.CONFIRMED]: 'تم تأكيد الحجز',
    [BOOKING_STATUSES.CANCELLED]: 'تم إلغاء الحجز',
    [BOOKING_STATUSES.COMPLETED]: 'تم إكمال الحجز',
    [BOOKING_STATUSES.REJECTED]: 'تم رفض الحجز',
  };

  const notificationBodyMap = {
    [BOOKING_STATUSES.CONFIRMED]: `تم تأكيد موعدك مع ${providerLabel} بنجاح`,
    [BOOKING_STATUSES.CANCELLED]: `تم إلغاء موعدك مع ${providerLabel}`,
    [BOOKING_STATUSES.COMPLETED]: `تم تحديث حالتك إلى مكتمل مع ${providerLabel}`,
    [BOOKING_STATUSES.REJECTED]: `تم رفض طلب الحجز الخاص بك`,
  };

  if (booking.patientId && notificationTitleMap[booking.status]) {
    await sendNotificationToUser({
      userId: booking.patientId,
      title: notificationTitleMap[booking.status],
      body: notificationBodyMap[booking.status],
      type: 'booking_status',
      data: {
        bookingId: booking._id,
        status: booking.status,
        providerType: providerLabel,
      },
    });
  }

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
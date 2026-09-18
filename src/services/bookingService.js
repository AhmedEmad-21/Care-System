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
const { getTodayDateString } = require('../utils/dateUtils');

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

const resolveBookingPrice = async ({ doctorDoc, doctorId, nurseId, bookingType = 'regular' }) => {
  if (doctorDoc || doctorId) {
    const doctor = doctorDoc || await Doctor.findById(doctorId).lean();
    if (!doctor) throw new NotFoundError('Doctor not found');

    if (bookingType === 'urgent') {
      const urgentPrice = (doctor.urgentPrice != null && Number(doctor.urgentPrice) > 0)
        ? Number(doctor.urgentPrice)
        : Number(doctor.basePrice || doctor.baseVisitPrice || 0);
      return urgentPrice;
    }

    return Number(doctor.basePrice || doctor.baseVisitPrice || 0);
  }

  if (nurseId) {
    const nurse = await Nurse.findById(nurseId).lean();
    if (!nurse) throw new NotFoundError('Nurse not found');
    return Number(nurse.servicePrice || 0);
  }

  throw new BadRequestError('doctorId or nurseId is required');
};

const createDoctorBooking = async ({
  patientId,
  doctorId,
  nurseId,
  symptoms,
  requestLocation,
  appointmentTime,
  suggestedSpecialty,
  bookingType,
  priceType,
  consultationType
}) => {
  if (!doctorId && !nurseId) {
    throw new BadRequestError('doctorId or nurseId is required');
  }

  let resolvedDoctor = null;
  let resolvedDoctorId = doctorId || null;

  if (resolvedDoctorId) {
    // محاولة إيجاد الطبيب بالـ _id أو بـ userId للتوافق التام
    resolvedDoctor = await Doctor.findById(resolvedDoctorId).lean();
    if (!resolvedDoctor) {
      resolvedDoctor = await Doctor.findOne({ userId: resolvedDoctorId }).lean();
    }
    if (!resolvedDoctor) {
      throw new NotFoundError('Doctor not found');
    }
    resolvedDoctorId = resolvedDoctor._id;
  }

  const providerField = resolvedDoctorId ? 'doctorId' : 'nurseId';
  const providerId = resolvedDoctorId || nurseId;
  const providerLabel = resolvedDoctorId ? 'Doctor' : 'Nurse';

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

  if (resolvedDoctor && appointmentTime) {
    const targetDate = new Date(appointmentTime);
    const targetDateStr = getTodayDateString(targetDate);
    const targetDay = targetDate.getDay();

    if (Array.isArray(resolvedDoctor.unavailableDates) && resolvedDoctor.unavailableDates.includes(targetDateStr)) {
      throw new BadRequestError('الطبيب لا يستقبل حجوزات في هذا اليوم المحدد');
    }
    if (Array.isArray(resolvedDoctor.offDays) && resolvedDoctor.offDays.includes(targetDay)) {
      throw new BadRequestError('هذا اليوم يوافق يوم الإجازة الأسبوعية للطبيب');
    }
  }

  // نوع الحجز: regular أو urgent
  const normalizedBookingType = (bookingType || priceType || consultationType || 'regular').toLowerCase();
  const finalBookingType = normalizedBookingType === 'urgent' ? 'urgent' : 'regular';

  const totalCost = await resolveBookingPrice({
    doctorDoc: resolvedDoctor,
    doctorId: resolvedDoctorId,
    nurseId,
    bookingType: finalBookingType
  });

  // جلب اللوكيشن المسجل لليوزر تلقائياً لو الفرونت مابعتهوش
  let finalLocation = requestLocation;
  if (!finalLocation || !finalLocation.coordinates) {
    const user = await User.findById(patientId).lean();
    if (user && user.location) {
      finalLocation = user.location;
    }
  }

  const booking = await Booking.create({
    patientId,
    doctorId: resolvedDoctorId || null,
    nurseId: nurseId || null,
    bookingType: finalBookingType,
    symptoms,
    suggestedSpecialty: suggestedSpecialty || null,
    requestLocation: normalizeGeoPoint(finalLocation, 'requestLocation'),
    appointmentTime: appointmentTime || null,
    totalCost,
    status: BOOKING_STATUSES.PENDING,
  });

  // إرسال إشعار فوري وتلقائي للطبيب أو الممرض
  try {
    const patientUser = await User.findById(patientId).select('name phoneNumber').lean();
    const patientName = patientUser?.name || 'مريض';

    let targetUserId = null;
    if (resolvedDoctorId) {
      const doctorDoc = resolvedDoctor || await Doctor.findById(resolvedDoctorId).select('userId phoneNumber name').lean();
      if (doctorDoc?.userId) {
        targetUserId = doctorDoc.userId;
      } else if (doctorDoc?.phoneNumber) {
        const docUser = await User.findOne({ phoneNumber: doctorDoc.phoneNumber }).select('_id').lean();
        targetUserId = docUser?._id;
      }
    } else if (nurseId) {
      const nurseDoc = await Nurse.findById(nurseId).select('userId phoneNumber name').lean();
      if (nurseDoc?.userId) {
        targetUserId = nurseDoc.userId;
      } else if (nurseDoc?.phoneNumber) {
        const nurseUser = await User.findOne({ phoneNumber: nurseDoc.phoneNumber }).select('_id').lean();
        targetUserId = nurseUser?._id;
      }
    }

    if (targetUserId) {
      const bookingTypeLabel = finalBookingType === 'urgent' ? 'مستعجل ⚡' : 'عادي';
      await sendNotificationToUser({
        userId: targetUserId,
        title: `طلب حجز جديد (${bookingTypeLabel}) 🩺`,
        body: `لديك طلب حجز جديد (${bookingTypeLabel}) من المريض (${patientName}) بقيمة ${totalCost} ج.م. يرجى الدخول لتحديد موعد الكشف وتأكيد الحجز.`,
        type: 'booking',
        data: {
          bookingId: String(booking._id),
          bookingNumber: String(booking.bookingNumber || ''),
          patientId: String(patientId),
          type: resolvedDoctorId ? 'doctor' : 'nurse',
          bookingType: finalBookingType,
          totalCost: String(totalCost)
        }
      });
    }
  } catch (notifErr) {
    console.error('Failed to send booking notification to provider:', notifErr.message);
  }

  return booking;
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

  if (appointmentTime) {
    const targetDate = new Date(appointmentTime);
    const targetDateStr = getTodayDateString(targetDate);
    const targetDay = targetDate.getDay();

    if (Array.isArray(nurse.unavailableDates) && nurse.unavailableDates.includes(targetDateStr)) {
      throw new BadRequestError('الممرض لا يستقبل حجوزات في هذا اليوم المحدد');
    }
    if (Array.isArray(nurse.offDays) && nurse.offDays.includes(targetDay)) {
      throw new BadRequestError('هذا اليوم يوافق يوم الإجازة الأسبوعية للممرض');
    }
  }

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

  const booking = await NursingBooking.create({
    patientId,
    nurseId,
    serviceId,
    requestLocation: normalizeGeoPoint(finalLocation, 'requestLocation'),
    appointmentTime: appointmentTime || null,
    totalCost: nurse.servicePrice || 0,
    status: BOOKING_STATUSES.PENDING,
  });

  // إرسال إشعار فوري وتلقائي للممرض
  try {
    const patientUser = await User.findById(patientId).select('name phoneNumber').lean();
    const patientName = patientUser?.name || 'مريض';

    let targetUserId = nurse.userId;
    if (!targetUserId && nurse.phoneNumber) {
      const nurseUser = await User.findOne({ phoneNumber: nurse.phoneNumber }).select('_id').lean();
      targetUserId = nurseUser?._id;
    }

    if (targetUserId) {
      await sendNotificationToUser({
        userId: targetUserId,
        title: 'طلب خدمة تمريضية جديد 🩺',
        body: `لديك طلب خدمة تمريضية جديد من المريض (${patientName}). يرجى الدخول لتحديد الموعد وتأكيد الحجز.`,
        type: 'booking',
        data: {
          bookingId: String(booking._id),
          patientId: String(patientId),
          serviceId: String(serviceId),
          type: 'nursing'
        }
      });
    }
  } catch (notifErr) {
    console.error('Failed to send nursing booking notification to provider:', notifErr.message);
  }

  return booking;
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
  const providerId = booking.doctorId || booking.nurseId;
  
  const notificationTitleMap = {
    [BOOKING_STATUSES.CONFIRMED]: 'تم تأكيد الحجز',
    [BOOKING_STATUSES.CANCELLED]: 'تم إلغاء الحجز',
    [BOOKING_STATUSES.COMPLETED]: 'تم إكمال الحجز',
    [BOOKING_STATUSES.REJECTED]: 'تم رفض الحجز',
  };

  const notificationBodyMap = {
    [BOOKING_STATUSES.CONFIRMED]: `تم تأكيد موعدك مع ${providerLabel} بنجاح`,
    [BOOKING_STATUSES.CANCELLED]: `تم إلغاء موعدك مع ${providerLabel}`,
    [BOOKING_STATUSES.COMPLETED]: `تم إتمام زيارتك بنجاح. نرجو منك تقييم تجربتك ⭐`,
    [BOOKING_STATUSES.REJECTED]: `تم رفض طلب الحجز الخاص بك`,
  };

  if (booking.patientId && notificationTitleMap[booking.status]) {
    // بناء بيانات إضافية مخصصة لو الحالة completed عشان تفتح شاشة التقييم في الفرونت
    const notificationData = {
      bookingId: booking._id.toString(),
      status: booking.status,
      providerType: providerLabel, // 'Doctor' أو 'Nurse' متوافقة مع الـ reviewService
    };

    if (booking.status === BOOKING_STATUSES.COMPLETED && providerId) {
      notificationData.providerId = providerId.toString();
      notificationData.action = 'open_review_screen';
    }

    await sendNotificationToUser({
      userId: booking.patientId,
      title: notificationTitleMap[booking.status],
      body: notificationBodyMap[booking.status],
      type: booking.status === BOOKING_STATUSES.COMPLETED ? 'review_prompt' : 'booking_status',
      data: notificationData,
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
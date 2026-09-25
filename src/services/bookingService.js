const mongoose = require('mongoose');
const Booking = require('../models/bookingModel');
const NursingBooking = require('../models/nursingBookingModel');
const Doctor = require('../models/doctorModel');
const Nurse = require('../models/nurseModel');
const User = require('../models/userModel');
const { BadRequestError, NotFoundError, ForbiddenError } = require('../errors/appErrors');
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

const assertPatientActive = async (patientId) => {
  if (!patientId) return;
  const patient = await User.findById(patientId).select('accountStatus').lean();
  if (patient && patient.accountStatus === 'suspended') {
    throw new ForbiddenError('حسابك موقوف حالياً من قبل الإدارة، ولا يمكنك إجراء أي حجوزات جديدة. يرجى التواصل مع الدعم الفني.');
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

  await assertPatientActive(patientId);

  let resolvedDoctor = null;
  let resolvedDoctorId = doctorId || null;

  if (resolvedDoctorId) {
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

  if (appointmentTime && new Date(appointmentTime) < new Date()) {
    throw new BadRequestError('تاريخ/وقت الموعد لا يمكن أن يكون في الماضي');
  }

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

  const normalizedBookingType = (bookingType || priceType || consultationType || 'regular').toLowerCase();
  const finalBookingType = normalizedBookingType === 'urgent' ? 'urgent' : 'regular';

  const totalCost = await resolveBookingPrice({
    doctorDoc: resolvedDoctor,
    doctorId: resolvedDoctorId,
    nurseId,
    bookingType: finalBookingType
  });

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
      const bookingNumStr = booking.bookingNumber ? `رقم #${booking.bookingNumber} ` : '';
      await sendNotificationToUser({
        userId: targetUserId,
        title: `طلب حجز جديد ${bookingNumStr}(${bookingTypeLabel}) 🩺`,
        body: `لديك طلب حجز جديد ${bookingNumStr}(${bookingTypeLabel}) من المريض (${patientName}) بقيمة ${totalCost} ج.م. يرجى الدخول لتحديد موعد الكشف وتأكيد الحجز.`,
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
  await assertPatientActive(patientId);

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

  if (appointmentTime && new Date(appointmentTime) < new Date()) {
    throw new BadRequestError('تاريخ/وقت الموعد لا يمكن أن يكون في الماضي');
  }

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

  // إرسال إشعار فوري وتلقائي للممرض متضمناً رقم الحجز
  try {
    const patientUser = await User.findById(patientId).select('name phoneNumber').lean();
    const patientName = patientUser?.name || 'مريض';

    let targetUserId = nurse.userId;
    if (!targetUserId && nurse.phoneNumber) {
      const nurseUser = await User.findOne({ phoneNumber: nurse.phoneNumber }).select('_id').lean();
      targetUserId = nurseUser?._id;
    }

    if (targetUserId) {
      const bookingNumStr = booking.bookingNumber ? `رقم #${booking.bookingNumber} ` : '';
      await sendNotificationToUser({
        userId: targetUserId,
        title: `طلب خدمة تمريضية جديد ${bookingNumStr}🩺`,
        body: `لديك طلب خدمة تمريضية جديد ${bookingNumStr}من المريض (${patientName}). يرجى الدخول لتحديد الموعد وتأكيد الحجز.`,
        type: 'booking',
        data: {
          bookingId: String(booking._id),
          bookingNumber: String(booking.bookingNumber || ''),
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

// إرسال إشعارات الإلغاء الفورية للطرفين (مقدم الخدمة والمريض) بملاحظة الإدارة
const sendCancellationNotifications = async ({ booking, staffNote }) => {
  try {
    let providerTitle = 'مقدم الخدمة';
    let providerUserId = null;

    if (booking.doctorId) {
      const doctorDoc = await Doctor.findById(booking.doctorId).select('name userId phoneNumber').lean();
      if (doctorDoc) {
        providerTitle = `د. ${doctorDoc.name}`;
        if (doctorDoc.userId) {
          providerUserId = doctorDoc.userId;
        } else if (doctorDoc.phoneNumber) {
          const docUser = await User.findOne({ phoneNumber: doctorDoc.phoneNumber }).select('_id').lean();
          providerUserId = docUser?._id;
        }
      }
    } else if (booking.nurseId) {
      const nurseDoc = await Nurse.findById(booking.nurseId).select('name userId phoneNumber').lean();
      if (nurseDoc) {
        providerTitle = `الممرض ${nurseDoc.name}`;
        if (nurseDoc.userId) {
          providerUserId = nurseDoc.userId;
        } else if (nurseDoc.phoneNumber) {
          const nurseUser = await User.findOne({ phoneNumber: nurseDoc.phoneNumber }).select('_id').lean();
          providerUserId = nurseUser?._id;
        }
      }
    }

    const bookingNumStr = booking.bookingNumber ? `رقم #${booking.bookingNumber}` : '';
    const noteText = staffNote && String(staffNote).trim() ? String(staffNote).trim() : null;

    if (providerUserId) {
      const providerBody = noteText
        ? `تم إلغاء الحجز ${bookingNumStr} من قبل الإدارة. ملاحظة الإلغاء: "${noteText}".`
        : `تم إلغاء الحجز ${bookingNumStr} من قبل الإدارة.`;

      await sendNotificationToUser({
        userId: providerUserId,
        title: `إلغاء حجز ${bookingNumStr} من الإدارة ⚠️`,
        body: providerBody,
        type: 'booking_cancelled',
        data: {
          bookingId: String(booking._id),
          bookingNumber: String(booking.bookingNumber || ''),
          status: 'cancelled',
          staffNote: noteText || '',
          action: 'booking_cancelled',
        },
      }).catch((err) => console.error('Failed sending cancel notification to provider:', err.message));
    }

    if (booking.patientId) {
      const patientBody = noteText
        ? `تم إلغاء موعد حجزك ${bookingNumStr} مع ${providerTitle}. ملاحظة الإدارة: "${noteText}".`
        : `تم إلغاء موعد حجزك ${bookingNumStr} مع ${providerTitle}.`;

      await sendNotificationToUser({
        userId: booking.patientId,
        title: `تم إلغاء الحجز ${bookingNumStr} ❌`,
        body: patientBody,
        type: 'booking_cancelled',
        data: {
          bookingId: String(booking._id),
          bookingNumber: String(booking.bookingNumber || ''),
          status: 'cancelled',
          staffNote: noteText || '',
          action: 'booking_cancelled',
        },
      }).catch((err) => console.error('Failed sending cancel notification to patient:', err.message));
    }
  } catch (error) {
    console.error('Error in sendCancellationNotifications:', error.message);
  }
};

const updateBookingStatus = async ({ bookingId, status, appointmentTime, staffNote, confirmedByStaffId }) => {
  let booking = await Booking.findById(bookingId);
  let isNursing = false;
  if (!booking) {
    booking = await NursingBooking.findById(bookingId);
    if (booking) isNursing = true;
  }
  if (!booking) throw new NotFoundError('Booking not found');

  if (status === BOOKING_STATUSES.CANCELLED && (booking.status === BOOKING_STATUSES.CANCELLED || booking.status === BOOKING_STATUSES.COMPLETED)) {
    throw new BadRequestError(`لا يمكن إلغاء حجز حالته بالفعل: ${booking.status}`);
  }

  const before = booking.toObject();

  if (status) {
    booking.status = status;
  }

  if (appointmentTime) {
    if (new Date(appointmentTime) < new Date()) {
      throw new BadRequestError('تاريخ/وقت الموعد لا يمكن أن يكون في الماضي');
    }
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
    entityType: isNursing ? 'NursingBooking' : 'Booking',
    entityId: booking._id,
    before,
    after: booking.toObject(),
    meta: { status, appointmentTime, staffNote },
  });

  if (booking.status === BOOKING_STATUSES.CANCELLED) {
    await sendCancellationNotifications({ booking, staffNote });
    return booking;
  }

  const providerLabel = booking.doctorId ? 'الطبيب' : booking.nurseId ? 'الممرض' : 'مزود الخدمة';
  const providerId = booking.doctorId || booking.nurseId;
  const bookingNumStr = booking.bookingNumber ? `رقم #${booking.bookingNumber} ` : '';
  
  const notificationTitleMap = {
    [BOOKING_STATUSES.CONFIRMED]: `تم تأكيد الحجز ${bookingNumStr}`,
    [BOOKING_STATUSES.COMPLETED]: `تم إكمال الحجز ${bookingNumStr}`,
    [BOOKING_STATUSES.REJECTED]: `تم رفض الحجز ${bookingNumStr}`,
  };

  const notificationBodyMap = {
    [BOOKING_STATUSES.CONFIRMED]: `تم تأكيد موعد حجزك ${bookingNumStr}مع ${providerLabel} بنجاح`,
    [BOOKING_STATUSES.COMPLETED]: `تم إتمام زيارتك ${bookingNumStr}بنجاح. نرجو منك تقييم تجربتك ⭐`,
    [BOOKING_STATUSES.REJECTED]: `تم رفض طلب الحجز ${bookingNumStr}الخاص بك`,
  };

  if (booking.patientId && notificationTitleMap[booking.status]) {
    const notificationData = {
      bookingId: booking._id.toString(),
      bookingNumber: String(booking.bookingNumber || ''),
      status: booking.status,
      providerType: booking.doctorId ? 'Doctor' : booking.nurseId ? 'Nurse' : 'Provider',
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
    }).catch((err) => console.error('Error sending booking status notification:', err.message));
  }

  return booking;
};

const cancelBooking = async ({ bookingId, staffNote, confirmedByStaffId }) => updateBookingStatus({
  bookingId,
  status: BOOKING_STATUSES.CANCELLED,
  staffNote,
  confirmedByStaffId,
});

// إلغاء الحجز عبر رقم الحجز التسلسلي (مع إرسال إشعارات للطرفين بملاحظة الإدارة)
const cancelBookingByNumber = async ({ bookingNumber, staffNote, confirmedByStaffId }) => {
  if (!bookingNumber) {
    throw new BadRequestError('رقم الحجز مطلوب للإلغاء');
  }

  let booking = null;
  const num = Number(bookingNumber);

  if (!Number.isNaN(num)) {
    booking = await Booking.findOne({ bookingNumber: num });
    if (!booking) {
      booking = await NursingBooking.findOne({ bookingNumber: num });
    }
  }

  if (!booking && mongoose.Types.ObjectId.isValid(bookingNumber)) {
    booking = await Booking.findById(bookingNumber);
    if (!booking) {
      booking = await NursingBooking.findById(bookingNumber);
    }
  }

  if (!booking) {
    throw new NotFoundError('رقم الحجز غير صحيح أو غير موجود');
  }

  if (booking.status === BOOKING_STATUSES.CANCELLED || booking.status === BOOKING_STATUSES.COMPLETED) {
    throw new BadRequestError(`لا يمكن إلغاء حجز حالته بالفعل: ${booking.status}`);
  }

  const before = booking.toObject();

  booking.status = BOOKING_STATUSES.CANCELLED;
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
    action: 'BOOKING_CANCELLED_BY_NUMBER',
    entityType: booking.constructor?.modelName || 'Booking',
    entityId: booking._id,
    before,
    after: booking.toObject(),
    meta: { bookingNumber: booking.bookingNumber, staffNote },
  });

  // إرسال الإشعارات للطرفين (المريض ومزود الخدمة) مع ملاحظة الإدارة
  await sendCancellationNotifications({ booking, staffNote });

  return booking;
};

module.exports = {
  createDoctorBooking,
  createNursingBooking,
  listPendingBookings,
  updateBookingStatus,
  cancelBooking,
  cancelBookingByNumber,
  sendCancellationNotifications,
};
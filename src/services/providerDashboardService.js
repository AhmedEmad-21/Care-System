const Booking = require('../models/bookingModel');
const NursingBooking = require('../models/nursingBookingModel');
const Doctor = require('../models/doctorModel');
const Nurse = require('../models/nurseModel');
const User = require('../models/userModel');
const { sendNotificationToUser } = require('./notificationService');
const { NotFoundError, BadRequestError } = require('../errors/appErrors');
const { BOOKING_STATUSES } = require('../config/constants');
const { getTodayDateString } = require('../utils/dateUtils');

// دالة مساعدة لمعرفة هل المستخدم الحالي دكتور أم ممرض وجلب موديل البيانات المناسب
const getProviderDetails = async (userId, throwOnNotFound = false) => {
  const rawId = (userId && typeof userId === 'object') ? (userId.id || userId._id) : userId;
  if (!rawId) {
    if (throwOnNotFound) throw new NotFoundError('معرّف المستخدم غير متوفر');
    return null;
  }

  let provider = await Doctor.findOne({ userId: rawId }).lean();
  if (provider) {
    return { providerModel: Doctor, providerDoc: provider, type: 'doctor', field: 'doctorId' };
  }

  provider = await Nurse.findOne({ userId: rawId }).lean();
  if (provider) {
    return { providerModel: Nurse, providerDoc: provider, type: 'nurse', field: 'nurseId' };
  }

  // [تعافي تلقائي ذكي] في حال كان المستخدم مسجلاً بصلاحية Doctor أو Nurse ولكن ملفه غير مرتبط بالـ userId
  const user = await User.findById(rawId).lean();
  if (user) {
    if (user.role === 'Doctor') {
      // 1. محاولة الربط برقم الهاتف إن وجد ملف طبيب بنفس الرقم
      if (user.phoneNumber) {
        let matchedDoc = await Doctor.findOne({ phoneNumber: user.phoneNumber });
        if (matchedDoc) {
          matchedDoc.userId = user._id;
          await matchedDoc.save();
          return { providerModel: Doctor, providerDoc: matchedDoc.toObject(), type: 'doctor', field: 'doctorId' };
        }
      }

      // 2. إذا لم يكن هناك ملف طبيب إطلاقاً، إنشاء ملف طبيب مرتبط به فوراً
      const createdDoctor = await Doctor.create({
        name: user.name,
        userId: user._id,
        phoneNumber: user.phoneNumber,
        address: user.address || 'عنوان العيادة',
        specialization: 'باطنة',
        basePrice: 200,
        urgentPrice: 250,
        commissionRate: 10,
        description: '',
        unavailableDates: [],
        location: (user.location && Array.isArray(user.location.coordinates) && user.location.coordinates.length === 2)
          ? user.location
          : { type: 'Point', coordinates: [30.8428, 29.3084] },
        addedBy: user.createdByAdminID || user._id,
        isAvailable: true
      });
      return { providerModel: Doctor, providerDoc: createdDoctor.toObject(), type: 'doctor', field: 'doctorId' };
    }

    if (user.role === 'Nurse') {
      if (user.phoneNumber) {
        let matchedNurse = await Nurse.findOne({ phoneNumber: user.phoneNumber });
        if (matchedNurse) {
          matchedNurse.userId = user._id;
          await matchedNurse.save();
          return { providerModel: Nurse, providerDoc: matchedNurse.toObject(), type: 'nurse', field: 'nurseId' };
        }
      }

      const createdNurse = await Nurse.create({
        name: user.name,
        userId: user._id,
        phoneNumber: user.phoneNumber,
        location: (user.location && Array.isArray(user.location.coordinates) && user.location.coordinates.length === 2)
          ? user.location
          : { type: 'Point', coordinates: [30.8428, 29.3084] },
        commissionRate: 10,
        description: '',
        unavailableDates: [],
        addedBy: user.createdByAdminID || user._id,
        isAvailable: true
      });
      return { providerModel: Nurse, providerDoc: createdNurse.toObject(), type: 'nurse', field: 'nurseId' };
    }
  }

  if (throwOnNotFound) {
    throw new NotFoundError('لم يتم العثور على ملف مزود خدمة مرتبط بهذا الحساب');
  }
  return null;
};

// 1. عرض الحجوزات مع إمكانية الفلترة بالحالة أو التاريخ
const getProviderBookings = async ({ userId, status, date }) => {
  const details = await getProviderDetails(userId);
  if (!details) {
    return [];
  }
  const { providerDoc, field } = details;
  
  let query = { [field]: providerDoc._id };
  
  if (status) {
    query.status = status;
  }

  if (date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    query.appointmentTime = { $gte: start, $lt: end };
  }

  const bookings = await Booking.find(query)
    .populate('patientId', 'name phoneNumber profileImage')
    .sort({ createdAt: -1 })
    .lean();

  const nursingBookings = await NursingBooking.find(query)
    .populate('patientId', 'name phoneNumber profileImage')
    .populate('serviceId', 'name basePrice')
    .sort({ createdAt: -1 })
    .lean();

  const allBookings = [...bookings, ...nursingBookings];

  // منع أي تكرار مرجعي (Circular Reference) عند وجود أكثر من حجز لنفس المريض
  return allBookings.map((b) => ({
    ...b,
    isReviewed: Boolean(b.isReviewed),
    patientId: (b.patientId && typeof b.patientId === 'object')
      ? {
          _id: b.patientId._id,
          name: b.patientId.name,
          phoneNumber: b.patientId.phoneNumber,
          profileImage: b.patientId.profileImage || null
        }
      : b.patientId
  }));
};

// 2. تحديث موعد الحجز وتأكيده
const scheduleBooking = async ({ userId, bookingId, appointmentTime, status }) => {
  const { providerDoc, field, type } = await getProviderDetails(userId);

  let booking = await Booking.findOne({ _id: bookingId, [field]: providerDoc._id });
  let isNursing = false;

  if (!booking) {
    booking = await NursingBooking.findOne({ _id: bookingId, [field]: providerDoc._id });
    isNursing = true;
  }

  if (!booking) throw new NotFoundError('الحجز غير موجود أو ليس لديك صلاحية عليه');

  if (appointmentTime) {
    if (new Date(appointmentTime) < new Date()) {
      throw new BadRequestError('تاريخ/وقت الموعد لا يمكن أن يكون في الماضي');
    }
    booking.appointmentTime = appointmentTime;
  }
  if (status) booking.status = status;

  await booking.save();

  // إرسال إشعار فوري للمريض بتأكيد الموعد المحدد بالساعة
  if (booking.patientId) {
    try {
      const providerTitle = type === 'doctor' ? `د. ${providerDoc.name}` : `الممرض ${providerDoc.name}`;
      let timeFormatted = '';
      if (booking.appointmentTime) {
        const dateObj = new Date(booking.appointmentTime);
        timeFormatted = dateObj.toLocaleTimeString('ar-EG', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
          timeZone: 'Africa/Cairo'
        });
      }

      const bookingNumStr = booking.bookingNumber ? `رقم #${booking.bookingNumber} ` : '';
      const notifBody = timeFormatted
        ? `تم تأكيد موعد حجزك ${bookingNumStr}مع ${providerTitle} في تمام الساعة ${timeFormatted}.`
        : `تم تأكيد حجزك ${bookingNumStr}مع ${providerTitle}.`;

      await sendNotificationToUser({
        userId: booking.patientId,
        title: `تأكيد موعد الحجز ${bookingNumStr}🗓️`,
        body: notifBody,
        type: 'booking',
        data: {
          bookingId: String(booking._id),
          bookingNumber: String(booking.bookingNumber || ''),
          status: String(booking.status),
          appointmentTime: String(booking.appointmentTime || '')
        }
      });
    } catch (notifErr) {
      console.error('Failed to send booking schedule notification:', notifErr.message);
    }
  }

  return booking;
};

// 3. تغيير حالة الحجز (مثل مكتمل أو ملغي)
const updateBookingStatusService = async ({ userId, bookingId, status }) => {
  const { providerDoc, field, type } = await getProviderDetails(userId);

  let booking = await Booking.findOne({ _id: bookingId, [field]: providerDoc._id });
  if (!booking) {
    booking = await NursingBooking.findOne({ _id: bookingId, [field]: providerDoc._id });
  }

  if (!booking) throw new NotFoundError('الحجز غير موجود أو ليس لديك صلاحية عليه');

  booking.status = status;
  await booking.save();

  // إرسال إشعار فوري للمريض عند تغيير حالة الحجز
  if (booking.patientId) {
    try {
      const providerTitle = type === 'doctor' ? `د. ${providerDoc.name}` : `الممرض ${providerDoc.name}`;
      const bookingNumStr = booking.bookingNumber ? `رقم #${booking.bookingNumber} ` : '';
      let statusArabic = status;
      if (status === 'completed') statusArabic = 'اكتملت الزيارة بنجاح ✅';
      else if (status === 'cancelled') statusArabic = 'تم إلغاء الحجز ❌';
      else if (status === 'confirmed') statusArabic = 'تم تأكيد الحجز 🗓️';

      await sendNotificationToUser({
        userId: booking.patientId,
        title: `تحديث حالة الحجز ${bookingNumStr}: ${statusArabic}`,
        body: `تم تحديث حالة طلب الحجز ${bookingNumStr}الخاص بك مع ${providerTitle} إلى (${statusArabic}).`,
        type: 'booking',
        data: {
          bookingId: String(booking._id),
          bookingNumber: String(booking.bookingNumber || ''),
          status: String(booking.status)
        }
      });
    } catch (notifErr) {
      console.error('Failed to send status update notification:', notifErr.message);
    }
  }

  return booking;
};

// 4. عرض التسويات المالية (الحجوزات المكتملة المسوية والمستحقة) مع الفلترة بالتاريخ وحالة التسوية
const getProviderSettlements = async ({ userId, startDate, endDate, isSettled }) => {
  const details = await getProviderDetails(userId);
  if (!details) {
    return {
      summary: {
        totalRevenue: 0,
        totalCommission: 0,
        settledCommission: 0,
        pendingCommission: 0,
        settledAmount: 0,
        pendingSettlementAmount: 0,
        totalProviderEarnings: 0,
        settledProviderEarnings: 0,
        pendingProviderEarnings: 0
      },
      data: []
    };
  }

  const { providerDoc, field } = details;
  const commissionRate = providerDoc.commissionRate ?? 10;

  let query = {
    [field]: providerDoc._id,
    status: BOOKING_STATUSES.COMPLETED
  };

  if (isSettled !== undefined && isSettled !== '') {
    query.isSettled = isSettled === 'true' || isSettled === true;
  }

  if (startDate || endDate) {
    query.updatedAt = {};
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      query.updatedAt.$gte = start;
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query.updatedAt.$lte = end;
    }
  }

  const bookings = await Booking.find(query)
    .populate('patientId', 'name phoneNumber profileImage')
    .sort({ updatedAt: -1 })
    .lean();

  const nursingBookings = await NursingBooking.find(query)
    .populate('patientId', 'name phoneNumber profileImage')
    .populate('serviceId', 'name basePrice')
    .sort({ updatedAt: -1 })
    .lean();

  const allBookings = [...bookings, ...nursingBookings].sort(
    (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
  );

  let totalRevenue = 0;
  let totalCommission = 0;
  let settledCommission = 0;
  let pendingCommission = 0;
  let totalProviderEarnings = 0;
  let settledProviderEarnings = 0;
  let pendingProviderEarnings = 0;

  const formattedBookings = allBookings.map((b) => {
    const cost = b.totalCost || 0;
    const commission = (cost * commissionRate) / 100;
    const providerEarnings = cost - commission;

    totalRevenue += cost;
    totalCommission += commission;
    totalProviderEarnings += providerEarnings;

    if (b.isSettled) {
      settledCommission += commission;
      settledProviderEarnings += providerEarnings;
    } else {
      pendingCommission += commission;
      pendingProviderEarnings += providerEarnings;
    }

    return {
      ...b,
      patientId: (b.patientId && typeof b.patientId === 'object')
        ? {
            _id: b.patientId._id,
            name: b.patientId.name,
            phoneNumber: b.patientId.phoneNumber,
            profileImage: b.patientId.profileImage || null
          }
        : b.patientId,
      appliedCommissionRate: commissionRate,
      calculatedCommission: commission,
      providerEarnings
    };
  });

  return {
    summary: {
      totalRevenue,
      totalCommission,
      settledCommission,
      pendingCommission,
      settledAmount: settledCommission,
      pendingSettlementAmount: pendingCommission,
      totalProviderEarnings,
      settledProviderEarnings,
      pendingProviderEarnings
    },
    data: formattedBookings
  };
};

// 5. تعديل أيام الإجازة
const updateOffDaysService = async ({ userId, offDays }) => {
  const details = await getProviderDetails(userId);
  if (!details) {
    return { offDays: offDays || [] };
  }

  const { providerModel, providerDoc } = details;

  if (!Array.isArray(offDays)) {
    throw new BadRequestError('أيام الإجازة يجب أن تكون على هيئة مصفوفة أرقام');
  }

  const updatedProvider = await providerModel.findByIdAndUpdate(
    providerDoc._id,
    { offDays },
    { new: true }
  ).lean();

  return updatedProvider;
};

// 6. جلب حالة استقبال الحجوزات لليوم الحالي
const getTodayAvailabilityService = async ({ userId }) => {
  const details = await getProviderDetails(userId, true);
  const { providerDoc, type } = details;

  const todayStr = getTodayDateString();
  const todayDay = new Date().getDay();
  const unavailableDates = Array.isArray(providerDoc.unavailableDates) ? providerDoc.unavailableDates : [];
  const offDays = Array.isArray(providerDoc.offDays) ? providerDoc.offDays : [];

  const isDayOff = offDays.includes(todayDay);
  const isDateBlocked = unavailableDates.includes(todayStr);
  const isAvailableToday = Boolean(providerDoc.isAvailable) && !isDateBlocked && !isDayOff;

  return {
    date: todayStr,
    type,
    isAvailableToday,
    isDateBlocked,
    isDayOff,
    isAvailable: Boolean(providerDoc.isAvailable),
    unavailableDates
  };
};

// 7. تبديل / تحديث حالة استقبال الحجوزات لليوم الحالي (زر التحكم في الداش بورد)
const toggleTodayAvailabilityService = async ({ userId, isAvailableToday }) => {
  const details = await getProviderDetails(userId, true);
  const { providerModel, providerDoc, type } = details;

  const todayStr = getTodayDateString();
  let unavailableDates = Array.isArray(providerDoc.unavailableDates) ? [...providerDoc.unavailableDates] : [];

  let newAvailableState;
  if (typeof isAvailableToday === 'boolean') {
    newAvailableState = isAvailableToday;
  } else {
    // تبديل تلقائي للحالة (Toggle)
    const currentlyBlocked = unavailableDates.includes(todayStr);
    newAvailableState = currentlyBlocked; // إذا كان محظوراً، نجعله متاحاً
  }

  if (newAvailableState) {
    // متاح اليوم -> نزيل تاريخ اليوم من قائمة التواريخ غير المتاحة
    unavailableDates = unavailableDates.filter(d => d !== todayStr);
  } else {
    // غير متاح اليوم -> نضيف تاريخ اليوم
    if (!unavailableDates.includes(todayStr)) {
      unavailableDates.push(todayStr);
    }
  }

  const updatedProvider = await providerModel.findByIdAndUpdate(
    providerDoc._id,
    { unavailableDates },
    { new: true }
  ).lean();

  const todayDay = new Date().getDay();
  const offDays = Array.isArray(updatedProvider.offDays) ? updatedProvider.offDays : [];
  const isDayOff = offDays.includes(todayDay);
  const isDateBlocked = unavailableDates.includes(todayStr);

  return {
    date: todayStr,
    type,
    isAvailableToday: Boolean(updatedProvider.isAvailable) && !isDateBlocked && !isDayOff,
    isDateBlocked,
    isDayOff,
    isAvailable: Boolean(updatedProvider.isAvailable),
    unavailableDates
  };
};

// 8. تحديث الوصف التعريفي لمزود الخدمة
const updateDescriptionService = async ({ userId, description }) => {
  const details = await getProviderDetails(userId, true);
  const { providerModel, providerDoc, type } = details;

  const updatedProvider = await providerModel.findByIdAndUpdate(
    providerDoc._id,
    { description: typeof description === 'string' ? description.trim() : '' },
    { new: true }
  ).lean();

  return {
    type,
    _id: updatedProvider._id,
    name: updatedProvider.name,
    description: updatedProvider.description || ''
  };
};

// 9. جلب بروفايل المزود في الداش بورد كاملاً
const getProviderProfileService = async ({ userId }) => {
  const details = await getProviderDetails(userId, true);
  const { providerDoc, type } = details;

  const todayStr = getTodayDateString();
  const todayDay = new Date().getDay();
  const unavailableDates = Array.isArray(providerDoc.unavailableDates) ? providerDoc.unavailableDates : [];
  const offDays = Array.isArray(providerDoc.offDays) ? providerDoc.offDays : [];

  const isDayOff = offDays.includes(todayDay);
  const isDateBlocked = unavailableDates.includes(todayStr);
  const isAvailableToday = Boolean(providerDoc.isAvailable) && !isDateBlocked && !isDayOff;

  return {
    ...providerDoc,
    description: providerDoc.description || '',
    type,
    isAvailableToday,
    isDateBlocked,
    isDayOff
  };
};

module.exports = {
  getProviderBookings,
  scheduleBooking,
  updateBookingStatusService,
  getProviderSettlements,
  updateOffDaysService,
  getProviderDetails,
  getTodayAvailabilityService,
  toggleTodayAvailabilityService,
  updateDescriptionService,
  getProviderProfileService
};
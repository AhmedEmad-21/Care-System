const Booking = require('../models/bookingModel');
const NursingBooking = require('../models/nursingBookingModel');
const Doctor = require('../models/doctorModel');
const Nurse = require('../models/nurseModel');
const { NotFoundError, BadRequestError } = require('../errors/appErrors');
const { BOOKING_STATUSES } = require('../config/constants');

// دالة مساعدة لمعرفة هل المستخدم الحالي دكتور أم ممرض وجلب موديل البيانات المناسب
const getProviderDetails = async (userId) => {
  let provider = await Doctor.findOne({ userId }).lean();
  if (provider) {
    return { providerModel: Doctor, providerDoc: provider, type: 'doctor', field: 'doctorId' };
  }

  provider = await Nurse.findOne({ userId }).lean();
  if (provider) {
    return { providerModel: Nurse, providerDoc: provider, type: 'nurse', field: 'nurseId' };
  }

  throw new NotFoundError('لم يتم العثور على ملف مزود خدمة مرتبط بهذا الحساب');
};

// 1. عرض الحجوزات مع إمكانية الفلترة بالحالة أو التاريخ
const getProviderBookings = async ({ userId, status, date }) => {
  const { providerDoc, field } = await getProviderDetails(userId);
  
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
    .populate('patientId', 'name phoneNumber')
    .sort({ createdAt: -1 })
    .lean();

  const nursingBookings = await NursingBooking.find(query)
    .populate('patientId', 'name phoneNumber')
    .populate('serviceId', 'name basePrice')
    .sort({ createdAt: -1 })
    .lean();

  return [...bookings, ...nursingBookings];
};

// 2. تحديث موعد الحجز وتأكيده
const scheduleBooking = async ({ userId, bookingId, appointmentTime, status }) => {
  const { field } = await getProviderDetails(userId);

  let booking = await Booking.findOne({ _id: bookingId, [field]: { $exists: true } });
  let isNursing = false;

  if (!booking) {
    booking = await NursingBooking.findOne({ _id: bookingId, [field]: { $exists: true } });
    isNursing = true;
  }

  if (!booking) throw new NotFoundError('الحجز غير موجود أو ليس لديك صلاحية عليه');

  if (appointmentTime) booking.appointmentTime = appointmentTime;
  if (status) booking.status = status;

  await booking.save();
  return booking;
};

// 3. تغيير حالة الحجز (مثل مكتمل أو ملغي)
const updateBookingStatusService = async ({ userId, bookingId, status }) => {
  const { field } = await getProviderDetails(userId);

  let booking = await Booking.findOne({ _id: bookingId, [field]: { $exists: true } });
  if (!booking) {
    booking = await NursingBooking.findOne({ _id: bookingId, [field]: { $exists: true } });
  }

  if (!booking) throw new NotFoundError('الحجز غير موجود');

  booking.status = status;
  await booking.save();
  return booking;
};

// 4. عرض التسويات المالية (الحجوزات المكتملة المسوية والمستحقة) مع الفلترة بالتاريخ وحالة التسوية
const getProviderSettlements = async ({ userId, startDate, endDate, isSettled }) => {
  const { providerDoc, field } = await getProviderDetails(userId);
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
    .populate('patientId', 'name phoneNumber')
    .sort({ updatedAt: -1 })
    .lean();

  const nursingBookings = await NursingBooking.find(query)
    .populate('patientId', 'name phoneNumber')
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
      totalProviderEarnings,
      settledProviderEarnings,
      pendingProviderEarnings
    },
    data: formattedBookings
  };
};

// 5. تعديل أيام الإجازة
const updateOffDaysService = async ({ userId, offDays }) => {
  const { providerModel, providerDoc } = await getProviderDetails(userId);

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

module.exports = {
  getProviderBookings,
  scheduleBooking,
  updateBookingStatusService,
  getProviderSettlements,
  updateOffDaysService
};
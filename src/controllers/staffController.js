const asyncHandler = require('../utils/asyncHandler');
const Doctor = require('../models/doctorModel');
const Nurse = require('../models/nurseModel');
const NursingService = require('../models/nursingServiceModel');
const Booking = require('../models/bookingModel');
const NursingBooking = require('../models/nursingBookingModel');
const AuditLog = require('../models/auditLogModel');
const User = require('../models/userModel');
const { cancelBooking } = require('../services/bookingService');
const { logAuditEvent, listAuditLogs } = require('../services/auditLogService');

// 1. عرض ومتابعة جميع الحجوزات مع إمكانية الفلترة الشاملة
const listAllBookings = asyncHandler(async (req, res) => {
  const { status, providerId, startDate, endDate, limit } = req.query;

  let query = {};

  if (status) {
    query.status = status;
  }

  if (providerId) {
    query.$or = [{ doctorId: providerId }, { nurseId: providerId }];
  }

  if (startDate && endDate) {
    query.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  }

  const bookings = await Booking.find(query)
    .populate('patientId', 'name phoneNumber')
    .populate('doctorId', 'name specialization')
    .populate('nurseId', 'name')
    .sort({ createdAt: -1 })
    .limit(limit ? Number(limit) : 50);

  return res.json({
    success: true,
    count: bookings.length,
    data: bookings,
  });
});

// 2. إلغاء الحجز بالطريقة العادية بواسطة الستاف
const cancelBookingHandler = asyncHandler(async (req, res) => {
  const booking = await cancelBooking({
    bookingId: req.params.id,
    staffNote: req.body.staffNote,
    confirmedByStaffId: req.user.id || req.user._id,
  });
  return res.json({ success: true, message: 'Booking cancelled', data: booking });
});

// 3. إلغاء الحجز عبر رقم الحجز التسلسلي (للدعم الفني)
const cancelBookingByNumberHandler = asyncHandler(async (req, res) => {
  const { bookingNumber } = req.params;
  const { staffNote } = req.body;

  const booking = await Booking.findOne({ bookingNumber: Number(bookingNumber) });
  if (!booking) {
    return res.status(404).json({ success: false, message: 'رقم الحجز غير صحيح أو غير موجود' });
  }

  if (booking.status === 'cancelled' || booking.status === 'completed') {
    return res.status(400).json({ success: false, message: `لا يمكن إلغاء حجز حالته بالفعل: ${booking.status}` });
  }

  booking.status = 'cancelled';
  if (staffNote) booking.staffNote = staffNote;
  booking.confirmedByStaffId = req.user.id || req.user._id;
  await booking.save();

  return res.json({ success: true, message: 'تم إلغاء الحجز بنجاح بناءً على طلب الدعم الفني', data: booking });
});

// 4. جلب الحجوزات المكتملة بغرض التسوية الأسبوعية
const getCompletedBookingsForSettlement = asyncHandler(async (req, res) => {
  const { startDate, endDate, providerId, isSettled } = req.query;

  let query = { status: 'completed' };

  if (isSettled !== undefined) {
    query.isSettled = isSettled === 'true';
  }

  if (startDate && endDate) {
    query.updatedAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  }

  if (providerId) {
    query.$or = [{ doctorId: providerId }, { nurseId: providerId }];
  }

  const bookings = await Booking.find(query)
    .populate('patientId', 'name phoneNumber')
    .populate('doctorId', 'name specialization commissionRate basePrice urgentPrice')
    .populate('nurseId', 'name commissionRate')
    .sort({ updatedAt: -1 });

  let totalRevenue = 0;
  let totalCommission = 0;

  const formattedBookings = bookings.map(b => {
    const cost = b.totalCost || 0;
    const provider = b.doctorId || b.nurseId;
    const rate = provider?.commissionRate || 10;
    const commission = (cost * rate) / 100;

    totalRevenue += cost;
    totalCommission += commission;

    return {
      ...b.toObject(),
      calculatedCommission: commission,
      appliedCommissionRate: rate
    };
  });

  return res.json({
    success: true,
    count: formattedBookings.length,
    summary: { totalRevenue, totalCommission },
    data: formattedBookings,
  });
});

// 5. تنفيذ التسوية الأسبوعية (فردي أو جماعي Bulk)
const settleBookings = asyncHandler(async (req, res) => {
  const { bookingIds } = req.body;

  if (!bookingIds || !Array.isArray(bookingIds) || bookingIds.length === 0) {
    return res.status(400).json({ success: false, message: 'يرجى تحديد حجز واحد على الأقل للتسوية' });
  }

  const result = await Booking.updateMany(
    { _id: { $in: bookingIds }, status: 'completed', isSettled: false },
    { $set: { isSettled: true, settledAt: new Date() } }
  );

  return res.json({
    success: true,
    message: `تم تسوية ${result.modifiedCount} حجز بنجاح`,
    modifiedCount: result.modifiedCount,
  });
});

// 6. جلب تفاصيل حجز واحد بالكامل
const getBookingDetails = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id)
    .populate('patientId', 'name phoneNumber email')
    .populate('doctorId', 'name specialization commissionRate basePrice urgentPrice')
    .populate('nurseId', 'name commissionRate')
    .populate('confirmedByStaffId', 'name');

  if (!booking) {
    return res.status(404).json({ success: false, message: 'الحجز غير موجود' });
  }

  return res.json({ success: true, data: booking });
});

// 7. جلب الملخص المالي لمزود الخدمة
const getProviderFinancialSummary = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const provider = await Doctor.findById(id) || await Nurse.findById(id);
  if (!provider) {
    return res.status(404).json({ success: false, message: 'مزود الخدمة غير موجود' });
  }

  const rate = provider.commissionRate ?? 10;

  const bookings = await Booking.find({ 
    $or: [{ doctorId: id }, { nurseId: id }],
    status: 'completed'
  });

  let totalEarnings = 0;
  let settledAmount = 0;
  let pendingSettlementAmount = 0;

  bookings.forEach(b => {
    const cost = b.totalCost || 0;
    const providerShare = cost - (cost * rate) / 100;

    totalEarnings += providerShare;
    if (b.isSettled) {
      settledAmount += providerShare;
    } else {
      pendingSettlementAmount += providerShare;
    }
  });

  return res.json({
    success: true,
    data: {
      providerId: id,
      commissionRate: rate,
      totalCompletedBookings: bookings.length,
      totalEarnings,
      settledAmount,
      pendingSettlementAmount
    }
  });
});

// 8. تعديل بيانات الحجز يدوياً بواسطة الأدمن (Admin Override)
const updateBookingByAdmin = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const booking = await Booking.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
  if (!booking) {
    return res.status(404).json({ success: false, message: 'الحجز غير موجود' });
  }

  await logAuditEvent({ 
    actorId: req.user.id || req.user._id, 
    actorRole: 'Admin', 
    action: 'ADMIN_UPDATE_BOOKING', 
    entityId: booking._id, 
    entityType: 'Booking',
    meta: { updates } 
  });

  return res.json({ success: true, message: 'تم تحديث بيانات الحجز بنجاح', data: booking });
});

const providerAvailability = asyncHandler(async (req, res) => {
  const { providerType, providerId, appointmentTime } = req.query;
  const time = new Date(appointmentTime);
  const weekday = time.getDay();
  const Model = providerType === 'doctor' ? Doctor : Nurse;
  const provider = await Model.findById(providerId).lean();
  if (!provider) return res.status(404).json({ success: false, message: 'Provider not found' });
  const isAvailable = provider.isAvailable && (!provider.offDays?.includes(weekday));
  return res.json({ success: true, available: isAvailable });
});

const doctorsStatus = asyncHandler(async (req, res) => {
  const doctors = await Doctor.find().lean();
  return res.json({ success: true, data: doctors });
});

const analytics = asyncHandler(async (req, res) => {
  const [aggTotal, byStatus] = await Promise.all([Booking.countDocuments(), Booking.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }])]);
  return res.json({ success: true, data: { totalBookings: aggTotal, byStatus } });
});

const toggleProviderStatus = asyncHandler(async (req, res) => {
  const { type, id } = req.params;
  const Model = type === 'doctor' ? Doctor : Nurse;
  const provider = await Model.findById(id);
  if (!provider) return res.status(404).json({ success: false, message: 'Not found' });
  provider.isAvailable = !provider.isAvailable;
  await provider.save();
  return res.json({ success: true, data: { isAvailable: provider.isAvailable } });
});

// 9. إنشاء طبيب جديد (مع إجبار commissionRate فقط، وباقي الحقول مثل urgentPrice و profileImage اختيارية)
const createDoctor = asyncHandler(async (req, res) => {
  try {
    const { email, password, name, phoneNumber, address, profileImage, location, basePrice, urgentPrice, commissionRate, ...doctorData } = req.body;

    if (commissionRate === undefined) {
      return res.status(400).json({ success: false, message: 'نسبة العمولة (commissionRate) مطلوبة' });
    }

    const user = await User.create({
      role: 'Doctor',
      name,
      email,
      passwordHash: password,
      phoneNumber,
      address: address || 'عنوان الطبيب',
      profileImage: profileImage || undefined,
      location,
      createdByAdminID: req.user.id || req.user._id
    });

    const doctor = await Doctor.create({
      ...doctorData,
      name,
      phoneNumber,
      address,
      profileImage: profileImage || undefined,
      location,
      basePrice,
      urgentPrice: urgentPrice !== undefined ? urgentPrice : undefined, 
      commissionRate, 
      userId: user._id,
      addedBy: req.user.id || req.user._id
    });

    await logAuditEvent({ 
      actorId: req.user.id || req.user._id, 
      actorRole: 'Staff', 
      action: 'CREATE_DOCTOR', 
      entityId: doctor._id, 
      entityType: 'Doctor',
      meta: { name, basePrice, urgentPrice, commissionRate } 
    });

    return res.status(201).json({ success: true, data: { doctor, user: { email: user.email, role: user.role } } });
  } catch (error) {
    if (error.code === 11000) {
      const message = error.keyValue.email ? 'هذا البريد الإلكتروني مستخدم بالفعل' : 
                      error.keyValue.phoneNumber ? 'هذا الطبيب مسجل بالفعل بنفس رقم الهاتف' : 
                      'يوجد طبيب آخر مسجل بالفعل في هذا الموقع الجغرافي بالضبط';
      return res.status(409).json({ success: false, message });
    }
    throw error;
  }
});

const updateDoctor = asyncHandler(async (req, res) => {
  try {
    const doctor = await Doctor.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    return res.json({ success: true, data: doctor });
  } catch (error) {
    if (error.code === 11000) {
      const message = error.keyValue?.phoneNumber ? 'هذا الطبيب مسجل بالفعل بنفس رقم الهاتف' : 'يوجد طبيب آخر مسجل بالفعل في هذا الموقع الجغرافي بالضبط';
      return res.status(409).json({ success: false, message });
    }
    throw error;
  }
});

const listNursingServices = asyncHandler(async (req, res) => {
  const services = await NursingService.find().lean();
  return res.json({ success: true, data: services });
});

const createNursingService = asyncHandler(async (req, res) => {
  try {
    const service = await NursingService.create(req.body);
    return res.status(201).json({ success: true, data: service });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'هذه الخدمة موجودة بالفعل' });
    }
    throw error;
  }
});

const updateNursingService = asyncHandler(async (req, res) => {
  const service = await NursingService.findByIdAndUpdate(req.params.id, req.body, { new: true });
  return res.json({ success: true, data: service });
});

const listAuditLogsHandler = asyncHandler(async (req, res) => {
  const logs = await listAuditLogs({ limit: req.query.limit });
  return res.json({ success: true, data: logs });
});

// 10. إنشاء ممرض جديد (مع إجبار commissionRate فقط، و profileImage اختيارية)
const createNurse = asyncHandler(async (req, res) => {
  try {
    const { email, password, name, phoneNumber, address, location, profileImage, commissionRate, ...nurseData } = req.body;

    if (commissionRate === undefined) {
      return res.status(400).json({ success: false, message: 'نسبة العمولة (commissionRate) مطلوبة' });
    }

    const user = await User.create({
      role: 'Nurse',
      name,
      email,
      passwordHash: password,
      phoneNumber,
      address: address || 'عنوان الممرض',
      profileImage: profileImage || undefined,
      location,
      createdByAdminID: req.user.id || req.user._id
    });

    const nurse = await Nurse.create({
      ...nurseData,
      name,
      phoneNumber,
      location,
      profileImage: profileImage || undefined, 
      commissionRate, 
      userId: user._id,
      addedBy: req.user.id || req.user._id
    });

    await logAuditEvent({ 
      actorId: req.user.id || req.user._id, 
      actorRole: 'Staff', 
      action: 'CREATE_NURSE', 
      entityId: nurse._id, 
      entityType: 'Nurse', 
      meta: { name, commissionRate } 
    });

    return res.status(201).json({ success: true, data: { nurse, user: { email: user.email, role: user.role } } });
  } catch (error) {
    if (error.code === 11000) {
      const message = error.keyValue.email ? 'هذا البريد الإلكتروني مستخدم بالفعل' : 
                      error.keyValue.phoneNumber ? 'هذا الممرض مسجل بالفعل بنفس رقم الهاتف' : 
                      'يوجد ممرض آخر مسجل بالفعل في هذا الموقع الجغرافي بالضبط';
      return res.status(409).json({ success: false, message });
    }
    throw error;
  }
});

// إنشاء حساب Staff أو Admin جديد (مُحدث لاستقبال رقم الهاتف)
const createStaffOrAdmin = asyncHandler(async (req, res) => {
  try {
    const { name, email, password, role, phoneNumber } = req.body;

    const user = await User.create({
      role,
      name,
      email,
      passwordHash: password,
      phoneNumber, // تم استبدال القيمة الثابتة بالرقم القادم من الطلب
      address: 'الإدارة',
      accountStatus: 'active',
      vettingStatus: 'approved',
      createdByAdminID: req.user.id || req.user._id
    });

    await logAuditEvent({ 
      actorId: req.user.id || req.user._id, 
      actorRole: req.user.role, 
      action: `CREATE_${role.toUpperCase()}`, 
      entityId: user._id, 
      entityType: 'User', 
      meta: { name, email, role, phoneNumber } 
    });

    return res.status(201).json({ 
      success: true, 
      message: `تم إنشاء حساب الـ ${role} بنجاح`,
      data: { 
        id: user._id,
        name: user.name,
        email: user.email, 
        role: user.role,
        phoneNumber: user.phoneNumber 
      } 
    });
  } catch (error) {
    if (error.code === 11000) {
      const message = error.keyValue.email 
        ? 'هذا البريد الإلكتروني مستخدم بالفعل' 
        : error.keyValue.phoneNumber 
        ? 'رقم الهاتف هذا مستخدم بالفعل لحساب آخر' 
        : 'هناك بيانات مسجلة مسبقاً بنفس القيمة';
        
      return res.status(409).json({ success: false, message });
    }
    throw error;
  }
});

module.exports = {
  listAllBookings, cancelBookingHandler, cancelBookingByNumberHandler,
  getCompletedBookingsForSettlement, settleBookings, getBookingDetails, 
  getProviderFinancialSummary, updateBookingByAdmin, providerAvailability, 
  doctorsStatus, analytics, toggleProviderStatus, createDoctor, updateDoctor, 
  listNursingServices, createNursingService, updateNursingService, 
  listAuditLogsHandler, createNurse, createStaffOrAdmin
};
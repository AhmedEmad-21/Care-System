const mongoose = require('mongoose');
const asyncHandler = require('../utils/asyncHandler');
const Doctor = require('../models/doctorModel');
const Nurse = require('../models/nurseModel');
const NursingService = require('../models/nursingServiceModel');
const Booking = require('../models/bookingModel');
const NursingBooking = require('../models/nursingBookingModel');
const AuditLog = require('../models/auditLogModel');
const User = require('../models/userModel');
const { cancelBooking, cancelBookingByNumber } = require('../services/bookingService');
const { logAuditEvent, listAuditLogs } = require('../services/auditLogService');
const { normalizeGeoPoint } = require('../utils/geoPoint');

// 1. عرض ومتابعة جميع الحجوزات مع إمكانية الفلترة الشاملة
const listAllBookings = asyncHandler(async (req, res) => {
  const { status, providerId, startDate, endDate, limit } = req.query;

  let query = {};
  let nursingQuery = {};

  if (status) {
    query.status = status;
    nursingQuery.status = status;
  }

  if (providerId) {
    query.$or = [{ doctorId: providerId }, { nurseId: providerId }];
    nursingQuery.nurseId = providerId;
  }

  if (startDate && endDate) {
    const dateFilter = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
    query.createdAt = dateFilter;
    nursingQuery.createdAt = dateFilter;
  }

  const [doctorBookings, nursingBookings] = await Promise.all([
    Booking.find(query)
      .populate('patientId', 'name phoneNumber')
      .populate('doctorId', 'name specialization description commissionRate')
      .populate('nurseId', 'name description commissionRate')
      .sort({ createdAt: -1 })
      .limit(limit ? Number(limit) : 100)
      .lean(),
    NursingBooking.find(nursingQuery)
      .populate('patientId', 'name phoneNumber')
      .populate('nurseId', 'name description commissionRate')
      .populate('serviceId', 'name description basePrice')
      .sort({ createdAt: -1 })
      .limit(limit ? Number(limit) : 100)
      .lean(),
  ]);

  const formattedNursing = nursingBookings.map((b) => {
    const cost = (typeof b.totalCost === 'number' && b.totalCost > 0)
      ? b.totalCost
      : Number(b.serviceId?.basePrice || 0);
    return {
      ...b,
      totalCost: cost,
      totalPrice: cost,
      isReviewed: Boolean(b.isReviewed),
    };
  });

  const formattedDoctor = doctorBookings.map((b) => ({
    ...b,
    isReviewed: Boolean(b.isReviewed),
  }));

  const allBookings = [...formattedDoctor, ...formattedNursing].sort(
    (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
  );

  const finalBookings = limit ? allBookings.slice(0, Number(limit)) : allBookings;

  return res.json({
    success: true,
    count: finalBookings.length,
    data: finalBookings,
  });
});

// 2. إلغاء الحجز بالطريقة العادية بواسطة الستاف
const cancelBookingHandler = asyncHandler(async (req, res) => {
  const staffNote = req.body.staffNote || req.body.cancellationReason || req.body.reason || req.body.note || req.body.cancelReason || '';
  const booking = await cancelBooking({
    bookingId: req.params.id,
    staffNote,
    confirmedByStaffId: req.user.id || req.user._id,
  });
  return res.json({
    success: true,
    message: 'تم إلغاء الحجز بنجاح وإرسال الإشعارات للطرفين بملاحظة الإلغاء',
    data: booking,
  });
});

// 3. إلغاء الحجز عبر رقم الحجز التسلسلي (للدعم الفني / الإلغاء السريع من الداش بورد)
const cancelBookingByNumberHandler = asyncHandler(async (req, res) => {
  const bookingNumber = req.params.bookingNumber || req.body.bookingNumber || req.query.bookingNumber;
  const staffNote = req.body.staffNote || req.body.cancellationReason || req.body.reason || req.body.note || req.body.cancelReason || '';

  const booking = await cancelBookingByNumber({
    bookingNumber,
    staffNote,
    confirmedByStaffId: req.user.id || req.user._id,
  });

  return res.json({
    success: true,
    message: `تم إلغاء الحجز رقم #${booking.bookingNumber || bookingNumber} بنجاح وإرسال الإشعارات للطرفين بملاحظة الإلغاء`,
    data: booking,
  });
});

// 4. جلب الحجوزات المكتملة بغرض التسوية الأسبوعية
const getCompletedBookingsForSettlement = asyncHandler(async (req, res) => {
  const { startDate, endDate, providerId, isSettled } = req.query;

  let query = { status: 'completed' };
  let nursingQuery = { status: 'completed' };

  if (isSettled !== undefined) {
    const isSettledBool = isSettled === 'true';
    query.isSettled = isSettledBool;
    nursingQuery.isSettled = isSettledBool;
  }

  if (startDate && endDate) {
    const dateFilter = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
    query.updatedAt = dateFilter;
    nursingQuery.updatedAt = dateFilter;
  }

  if (providerId) {
    query.$or = [{ doctorId: providerId }, { nurseId: providerId }];
    nursingQuery.nurseId = providerId;
  }

  const [bookings, nursingBookings] = await Promise.all([
    Booking.find(query)
      .populate('patientId', 'name phoneNumber')
      .populate('doctorId', 'name specialization commissionRate basePrice urgentPrice')
      .populate('nurseId', 'name commissionRate')
      .sort({ updatedAt: -1 })
      .lean(),
    NursingBooking.find(nursingQuery)
      .populate('patientId', 'name phoneNumber')
      .populate('nurseId', 'name commissionRate')
      .populate('serviceId', 'name basePrice')
      .sort({ updatedAt: -1 })
      .lean(),
  ]);

  const allBookings = [...bookings, ...nursingBookings].sort(
    (a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)
  );

  let totalRevenue = 0;
  let totalCommission = 0;
  let settledCommission = 0;
  let pendingCommission = 0;

  const formattedBookings = allBookings.map(b => {
    const cost = b.totalCost || 0;
    const provider = b.doctorId || b.nurseId;
    const rate = provider?.commissionRate || 10;
    const commission = (cost * rate) / 100;

    totalRevenue += cost;
    totalCommission += commission;

    if (b.isSettled) {
      settledCommission += commission;
    } else {
      pendingCommission += commission;
    }

    return {
      ...b,
      calculatedCommission: commission,
      appliedCommissionRate: rate,
      providerEarnings: cost - commission
    };
  });

  return res.json({
    success: true,
    count: formattedBookings.length,
    summary: {
      totalRevenue,
      totalCommission,
      settledCommission,
      pendingCommission,
      settledAmount: settledCommission,
      pendingSettlementAmount: pendingCommission
    },
    data: formattedBookings,
  });
});

// 5. تنفيذ التسوية الأسبوعية (تحصيل نسبة المنصة من المزود)
const settleBookings = asyncHandler(async (req, res) => {
  const { bookingIds } = req.body;

  if (!bookingIds || !Array.isArray(bookingIds) || bookingIds.length === 0) {
    return res.status(400).json({ success: false, message: 'يرجى تحديد حجز واحد على الأقل للتسوية' });
  }

  const [resultBookings, resultNursing] = await Promise.all([
    Booking.updateMany(
      { _id: { $in: bookingIds }, status: 'completed', isSettled: false },
      { $set: { isSettled: true, settledAt: new Date() } }
    ),
    NursingBooking.updateMany(
      { _id: { $in: bookingIds }, status: 'completed', isSettled: false },
      { $set: { isSettled: true, settledAt: new Date() } }
    ),
  ]);

  const modifiedCount = (resultBookings.modifiedCount || 0) + (resultNursing.modifiedCount || 0);

  return res.json({
    success: true,
    message: `تم تسوية وتحصيل نسبة المنصة لـ ${modifiedCount} حجز بنجاح`,
    modifiedCount,
  });
});

// 6. جلب تفاصيل حجز واحد بالكامل
const getBookingDetails = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id)
    .populate('patientId', 'name phoneNumber email')
    .populate('doctorId', 'name specialization commissionRate basePrice urgentPrice description')
    .populate('nurseId', 'name commissionRate description')
    .populate('confirmedByStaffId', 'name')
    .lean();

  if (!booking) {
    return res.status(404).json({ success: false, message: 'الحجز غير موجود' });
  }

  return res.json({ 
    success: true, 
    data: {
      ...booking,
      isReviewed: Boolean(booking.isReviewed),
    } 
  });
});

// 7. جلب الملخص المالي لمزود الخدمة (مُحدث لحساب نسبة وعمولة المنصة والتسويات بدقة)
const getProviderFinancialSummary = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const provider = (await Doctor.findById(id)) || (await Nurse.findById(id));
  if (!provider) {
    return res.status(404).json({ success: false, message: 'مزود الخدمة غير موجود' });
  }

  const rate = provider.commissionRate ?? 10;

  const [doctorBookings, nursingBookings] = await Promise.all([
    Booking.find({
      $or: [{ doctorId: id }, { nurseId: id }],
      status: 'completed'
    }).lean(),
    NursingBooking.find({
      nurseId: id,
      status: 'completed'
    }).lean()
  ]);

  const bookings = [...doctorBookings, ...nursingBookings];

  let totalRevenue = 0;
  let totalPlatformCommission = 0;
  let settledPlatformCommission = 0;
  let pendingPlatformCommission = 0;
  let totalProviderEarnings = 0;

  bookings.forEach((b) => {
    const cost = b.totalCost || 0;
    const platformShare = (cost * rate) / 100;
    const providerShare = cost - platformShare;

    totalRevenue += cost;
    totalPlatformCommission += platformShare;
    totalProviderEarnings += providerShare;

    if (b.isSettled) {
      settledPlatformCommission += platformShare;
    } else {
      pendingPlatformCommission += platformShare;
    }
  });

  return res.json({
    success: true,
    data: {
      providerId: id,
      providerName: provider.name,
      commissionRate: rate,
      totalCompletedBookings: bookings.length,
      totalRevenue,
      totalPlatformCommission,
      settledPlatformCommission,
      pendingPlatformCommission,
      totalEarnings: totalPlatformCommission,
      settledAmount: settledPlatformCommission,
      pendingSettlementAmount: pendingPlatformCommission,
      providerEarnings: totalProviderEarnings
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
  const formattedDoctors = doctors.map((doc) => ({
    ...doc,
    description: doc.description || '',
  }));
  return res.json({ success: true, data: formattedDoctors });
});

const nursesStatus = asyncHandler(async (req, res) => {
  const nurses = await Nurse.find().lean();
  const formattedNurses = nurses.map((nurse) => ({
    ...nurse,
    description: nurse.description || '',
  }));
  return res.json({ success: true, data: formattedNurses });
});

// 8.5 إحصائيات وتحليلات شاملة للوحة تحكم الـ Staff
const analytics = asyncHandler(async (req, res) => {
  const [
    totalDoctors,
    activeDoctors,
    totalNurses,
    activeNurses,
    totalPatients,
    totalBookingsCount,
    totalNursingBookingsCount,
    bookingStatusAgg,
    nursingStatusAgg,
    pendingSettledDoctor,
    pendingSettledNursing,
    completedDoctorBookings,
    completedNursingBookings
  ] = await Promise.all([
    Doctor.countDocuments(),
    Doctor.countDocuments({ isAvailable: true }),
    Nurse.countDocuments(),
    Nurse.countDocuments({ isAvailable: true }),
    User.countDocuments({ role: 'Patient' }),
    Booking.countDocuments(),
    NursingBooking.countDocuments(),
    Booking.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    NursingBooking.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Booking.countDocuments({ status: 'completed', isSettled: false }),
    NursingBooking.countDocuments({ status: 'completed', isSettled: false }),
    Booking.find({ status: 'completed' })
      .populate('doctorId', 'commissionRate')
      .populate('nurseId', 'commissionRate')
      .select('totalCost isSettled doctorId nurseId')
      .lean(),
    NursingBooking.find({ status: 'completed' })
      .populate('nurseId', 'commissionRate')
      .select('totalCost isSettled nurseId')
      .lean()
  ]);

  const totalBookings = totalBookingsCount + totalNursingBookingsCount;
  const pendingSettlementsCount = pendingSettledDoctor + pendingSettledNursing;

  const statusMap = {
    pending: 0,
    confirmed: 0,
    completed: 0,
    cancelled: 0,
    rejected: 0
  };

  [...bookingStatusAgg, ...nursingStatusAgg].forEach(item => {
    if (item._id) {
      statusMap[item._id] = (statusMap[item._id] || 0) + item.count;
    }
  });

  const byStatus = Object.keys(statusMap).map(status => ({
    _id: status,
    count: statusMap[status]
  }));

  let totalRevenue = 0;
  let totalPlatformCommission = 0;
  let settledPlatformCommission = 0;
  let pendingPlatformCommission = 0;

  [...completedDoctorBookings, ...completedNursingBookings].forEach(b => {
    const cost = b.totalCost || 0;
    const provider = b.doctorId || b.nurseId;
    const rate = provider?.commissionRate || 10;
    const commission = (cost * rate) / 100;

    totalRevenue += cost;
    totalPlatformCommission += commission;

    if (b.isSettled) {
      settledPlatformCommission += commission;
    } else {
      pendingPlatformCommission += commission;
    }
  });

  return res.json({
    success: true,
    data: {
      totalBookings,
      completedBookings: statusMap.completed || 0,
      pendingBookings: statusMap.pending || 0,
      confirmedBookings: statusMap.confirmed || 0,
      cancelledBookings: statusMap.cancelled || 0,
      totalDoctors,
      activeDoctors,
      totalNurses,
      activeNurses,
      totalPatients,
      pendingSettlementsCount,
      byStatus,
      financials: {
        totalRevenue,
        totalPlatformCommission,
        settledPlatformCommission,
        pendingPlatformCommission,
        settledAmount: settledPlatformCommission,
        pendingSettlementAmount: pendingPlatformCommission
      }
    }
  });
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
  let createdUser = null;
  try {
    const { email, password, name, phoneNumber, address, profileImage, location, basePrice, urgentPrice, commissionRate, ...doctorData } = req.body;

    if (commissionRate === undefined) {
      return res.status(400).json({ success: false, message: 'نسبة العمولة (commissionRate) مطلوبة' });
    }

    const normalizedLocation = normalizeGeoPoint(location, 'location');
    if (!normalizedLocation) {
      return res.status(400).json({ success: false, message: 'الموقع الجغرافي (location) مطلوب ويجب أن يحتوي على الإحداثيات [longitude, latitude]' });
    }

    const computedUrgentPrice = (urgentPrice !== undefined && urgentPrice !== null && urgentPrice !== '')
      ? Number(urgentPrice)
      : (Number(basePrice) || 0);

    const normalizedEmail = email ? email.toLowerCase().trim() : undefined;
    let user = await User.findOne({
      $or: [
        ...(normalizedEmail ? [{ email: normalizedEmail }] : []),
        ...(phoneNumber ? [{ phoneNumber }] : [])
      ]
    });

    if (user) {
      // إذا كان المستخدم موجوداً، نتحقق هل له ملف طبيب بالفعل
      const existingDoctor = await Doctor.findOne({ $or: [{ userId: user._id }, { phoneNumber: user.phoneNumber }] });
      if (existingDoctor) {
        const message = (user.email === normalizedEmail)
          ? 'هذا البريد الإلكتروني مستخدم بالفعل'
          : 'هذا الطبيب مسجل بالفعل بنفس رقم الهاتف';
        return res.status(409).json({ success: false, message });
      }

      // إذا كان الحساب موجوداً ولكن بدون ملف طبيب (Orphan User)، نقوم بتحديث الحساب وربطه
      user.role = 'Doctor';
      user.name = name;
      if (password) user.passwordHash = password;
      user.address = address || user.address || 'عنوان الطبيب';
      if (profileImage) user.profileImage = profileImage;
      user.location = normalizedLocation;
      user.accountStatus = 'active';
      user.vettingStatus = 'approved';
      await user.save();
    } else {
      user = await User.create({
        role: 'Doctor',
        name,
        email: normalizedEmail,
        passwordHash: password,
        phoneNumber,
        address: address || 'عنوان الطبيب',
        profileImage: profileImage || undefined,
        location: normalizedLocation,
        createdByAdminID: req.user.id || req.user._id
      });
      createdUser = user;
    }

    const doctor = await Doctor.create({
      ...doctorData,
      name,
      phoneNumber,
      address: address || 'عنوان الطبيب',
      profileImage: profileImage || undefined,
      location: normalizedLocation,
      basePrice: Number(basePrice) || 0,
      urgentPrice: computedUrgentPrice,
      commissionRate: Number(commissionRate) || 10,
      userId: user._id,
      addedBy: req.user.id || req.user._id
    });

    await logAuditEvent({
      actorId: req.user.id || req.user._id,
      actorRole: 'Staff',
      action: 'CREATE_DOCTOR',
      entityId: doctor._id,
      entityType: 'Doctor',
      meta: { name, basePrice: Number(basePrice) || 0, urgentPrice: computedUrgentPrice, commissionRate }
    });

    return res.status(201).json({
      success: true,
      data: {
        doctor,
        user: {
          id: user._id,
          email: user.email,
          role: user.role
        }
      }
    });
  } catch (error) {
    // في حالة فشل إنشاء ملف الطبيب لمستخدم جديد، نقوم بعمل Rollback وحذف المستخدم
    if (createdUser?._id) {
      await User.findByIdAndDelete(createdUser._id).catch(() => {});
    }

    if (error.code === 11000) {
      const message = error.keyValue?.email ? 'هذا البريد الإلكتروني مستخدم بالفعل' :
        error.keyValue?.phoneNumber ? 'هذا الطبيب مسجل بالفعل بنفس رقم الهاتف' :
          'هناك بيانات مسجلة مسبقاً بنفس القيمة';
      return res.status(409).json({ success: false, message });
    }
    throw error;
  }
});

const updateDoctor = asyncHandler(async (req, res) => {
  try {
    const updates = { ...req.body };
    if (updates.location) {
      updates.location = normalizeGeoPoint(updates.location, 'location');
    }

    const doctor = await Doctor.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'الطبيب غير موجود' });
    }

    if (doctor.userId) {
      const userUpdates = {};
      if (updates.name) userUpdates.name = updates.name;
      if (updates.email) userUpdates.email = updates.email.toLowerCase().trim();
      if (updates.phoneNumber) userUpdates.phoneNumber = updates.phoneNumber;
      if (updates.address) userUpdates.address = updates.address;
      if (updates.profileImage) userUpdates.profileImage = updates.profileImage;
      if (updates.location) userUpdates.location = updates.location;

      if (Object.keys(userUpdates).length > 0) {
        await User.findByIdAndUpdate(doctor.userId, userUpdates).catch(() => { });
      }
    }

    await logAuditEvent({
      actorId: req.user.id || req.user._id,
      actorRole: req.user.role,
      action: 'UPDATE_DOCTOR',
      entityId: doctor._id,
      entityType: 'Doctor',
      meta: { updates }
    });

    return res.json({ success: true, message: 'تم تحديث بيانات الطبيب بنجاح', data: doctor });
  } catch (error) {
    if (error.code === 11000) {
      const message = error.keyValue?.email
        ? 'هذا البريد الإلكتروني مستخدم بالفعل'
        : error.keyValue?.phoneNumber
          ? 'هذا الهاتف مسجل بالفعل لحساب آخر'
          : 'يوجد طبيب آخر مسجل بالفعل في هذا الموقع الجغرافي بالضبط';
      return res.status(409).json({ success: false, message });
    }
    throw error;
  }
});

const updateNurse = asyncHandler(async (req, res) => {
  try {
    const updates = { ...req.body };
    if (updates.location) {
      updates.location = normalizeGeoPoint(updates.location, 'location');
    }

    const nurse = await Nurse.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!nurse) {
      return res.status(404).json({ success: false, message: 'الممرض غير موجود' });
    }

    if (nurse.userId) {
      const userUpdates = {};
      if (updates.name) userUpdates.name = updates.name;
      if (updates.email) userUpdates.email = updates.email.toLowerCase().trim();
      if (updates.phoneNumber) userUpdates.phoneNumber = updates.phoneNumber;
      if (updates.address) userUpdates.address = updates.address;
      if (updates.profileImage) userUpdates.profileImage = updates.profileImage;
      if (updates.location) userUpdates.location = updates.location;

      if (Object.keys(userUpdates).length > 0) {
        await User.findByIdAndUpdate(nurse.userId, userUpdates).catch(() => { });
      }
    }

    await logAuditEvent({
      actorId: req.user.id || req.user._id,
      actorRole: req.user.role,
      action: 'UPDATE_NURSE',
      entityId: nurse._id,
      entityType: 'Nurse',
      meta: { updates }
    });

    return res.json({ success: true, message: 'تم تحديث بيانات الممرض بنجاح', data: nurse });
  } catch (error) {
    if (error.code === 11000) {
      const message = error.keyValue?.email
        ? 'هذا البريد الإلكتروني مستخدم بالفعل'
        : error.keyValue?.phoneNumber
          ? 'هذا الهاتف مسجل بالفعل لحساب آخر'
          : 'يوجد ممرض آخر مسجل بالفعل في هذا الموقع الجغرافي بالضبط';
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
  let createdUser = null;
  try {
    const { email, password, name, phoneNumber, address, location, profileImage, commissionRate, ...nurseData } = req.body;

    if (commissionRate === undefined) {
      return res.status(400).json({ success: false, message: 'نسبة العمولة (commissionRate) مطلوبة' });
    }

    const normalizedLocation = normalizeGeoPoint(location, 'location');
    if (!normalizedLocation) {
      return res.status(400).json({ success: false, message: 'الموقع الجغرافي (location) مطلوب ويجب أن يحتوي على الإحداثيات [longitude, latitude]' });
    }

    const normalizedEmail = email ? email.toLowerCase().trim() : undefined;
    let user = await User.findOne({
      $or: [
        ...(normalizedEmail ? [{ email: normalizedEmail }] : []),
        ...(phoneNumber ? [{ phoneNumber }] : [])
      ]
    });

    if (user) {
      const existingNurse = await Nurse.findOne({ $or: [{ userId: user._id }, { phoneNumber: user.phoneNumber }] });
      if (existingNurse) {
        const message = (user.email === normalizedEmail)
          ? 'هذا البريد الإلكتروني مستخدم بالفعل'
          : 'هذا الممرض مسجل بالفعل بنفس رقم الهاتف';
        return res.status(409).json({ success: false, message });
      }

      user.role = 'Nurse';
      user.name = name;
      if (password) user.passwordHash = password;
      user.address = address || user.address || 'عنوان الممرض';
      if (profileImage) user.profileImage = profileImage;
      user.location = normalizedLocation;
      user.accountStatus = 'active';
      user.vettingStatus = 'approved';
      await user.save();
    } else {
      user = await User.create({
        role: 'Nurse',
        name,
        email: normalizedEmail,
        passwordHash: password,
        phoneNumber,
        address: address || 'عنوان الممرض',
        profileImage: profileImage || undefined,
        location: normalizedLocation,
        createdByAdminID: req.user.id || req.user._id
      });
      createdUser = user;
    }

    const nurse = await Nurse.create({
      ...nurseData,
      name,
      phoneNumber,
      location: normalizedLocation,
      profileImage: profileImage || undefined,
      commissionRate: Number(commissionRate) || 10,
      userId: user._id,
      addedBy: req.user.id || req.user._id
    });

    await logAuditEvent({
      actorId: req.user.id || req.user._id,
      actorRole: 'Staff',
      action: 'CREATE_NURSE',
      entityId: nurse._id,
      entityType: 'Nurse',
      meta: { name, commissionRate: Number(commissionRate) || 10 }
    });

    return res.status(201).json({
      success: true,
      data: {
        nurse,
        user: {
          id: user._id,
          email: user.email,
          role: user.role
        }
      }
    });
  } catch (error) {
    if (createdUser?._id) {
      await User.findByIdAndDelete(createdUser._id).catch(() => {});
    }

    if (error.code === 11000) {
      const message = error.keyValue?.email ? 'هذا البريد الإلكتروني مستخدم بالفعل' :
        error.keyValue?.phoneNumber ? 'هذا الممرض مسجل بالفعل بنفس رقم الهاتف' :
          'هناك بيانات مسجلة مسبقاً بنفس القيمة';
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

// 11. البحث عن المستخدمين/المرضى للإشعارات الموجهة أو القوائم المنسدلة
const searchUsersForStaff = asyncHandler(async (req, res) => {
  const { query, search, role, limit } = req.query;
  const searchTerm = (query || search || '').trim();

  let filter = {};
  if (role) {
    filter.role = role;
  }

  if (searchTerm) {
    filter.$or = [
      { name: { $regex: searchTerm, $options: 'i' } },
      { email: { $regex: searchTerm, $options: 'i' } },
      { phoneNumber: { $regex: searchTerm, $options: 'i' } },
    ];
  }

  const maxLimit = Math.min(Number(limit) || 30, 100);
  const users = await User.find(filter)
    .select('_id name email role phoneNumber profileImage')
    .sort({ createdAt: -1 })
    .limit(maxLimit)
    .lean();

  return res.json({
    success: true,
    count: users.length,
    data: users,
  });
});

// 12. استرجاع قائمة الأطباء المخصصة للوحة تحكم الـ Staff
const listDoctorsForStaff = asyncHandler(async (req, res) => {
  const { query, search, isAvailable, specialization, limit } = req.query;
  const searchTerm = (query || search || '').trim();

  let filter = {};
  if (isAvailable !== undefined) {
    filter.isAvailable = isAvailable === 'true';
  }
  if (specialization) {
    filter.specialization = { $regex: specialization, $options: 'i' };
  }
  if (searchTerm) {
    filter.$or = [
      { name: { $regex: searchTerm, $options: 'i' } },
      { specialization: { $regex: searchTerm, $options: 'i' } },
      { phoneNumber: { $regex: searchTerm, $options: 'i' } },
    ];
  }

  const maxLimit = Math.min(Number(limit) || 50, 100);
  const doctors = await Doctor.find(filter)
    .populate('userId', 'email role accountStatus')
    .sort({ createdAt: -1 })
    .limit(maxLimit)
    .lean();

  const formattedDoctors = doctors.map((doc) => ({
    ...doc,
    description: doc.description || '',
  }));

  return res.json({
    success: true,
    count: formattedDoctors.length,
    data: formattedDoctors,
  });
});

// 13. استرجاع قائمة الممرضين المخصصة للوحة تحكم الـ Staff
const listNursesForStaff = asyncHandler(async (req, res) => {
  const { query, search, isAvailable, limit } = req.query;
  const searchTerm = (query || search || '').trim();

  let filter = {};
  if (isAvailable !== undefined) {
    filter.isAvailable = isAvailable === 'true';
  }
  if (searchTerm) {
    filter.$or = [
      { name: { $regex: searchTerm, $options: 'i' } },
      { phoneNumber: { $regex: searchTerm, $options: 'i' } },
    ];
  }

  const maxLimit = Math.min(Number(limit) || 50, 100);
  const nurses = await Nurse.find(filter)
    .populate('userId', 'email role accountStatus')
    .sort({ createdAt: -1 })
    .limit(maxLimit)
    .lean();

  const formattedNurses = nurses.map((nurse) => ({
    ...nurse,
    description: nurse.description || '',
  }));

  return res.json({
    success: true,
    count: formattedNurses.length,
    data: formattedNurses,
  });
});

// 14. استرجاع قائمة حسابات الـ Staff (ويمكن فلترة أو شمل Admin)
const listStaffAccounts = asyncHandler(async (req, res) => {
  const { role, query, search, accountStatus, limit } = req.query;
  const searchTerm = (query || search || '').trim();

  let filter = {};

  // الفلترة بالـ role: الافتراضي 'Staff'، مع إمكانية تحديد 'Admin' أو 'all'
  if (role) {
    if (role.toLowerCase() === 'all') {
      filter.role = { $in: ['Staff', 'Admin'] };
    } else {
      filter.role = role;
    }
  } else {
    filter.role = 'Staff';
  }

  if (accountStatus) {
    filter.accountStatus = accountStatus;
  }

  if (searchTerm) {
    filter.$or = [
      { name: { $regex: searchTerm, $options: 'i' } },
      { email: { $regex: searchTerm, $options: 'i' } },
      { phoneNumber: { $regex: searchTerm, $options: 'i' } },
    ];
  }

  const maxLimit = Math.min(Number(limit) || 50, 100);
  const accounts = await User.find(filter)
    .select('-passwordHash -resetPasswordTokenHash')
    .populate('createdByAdminID', 'name email')
    .sort({ createdAt: -1 })
    .limit(maxLimit)
    .lean();

  return res.json({
    success: true,
    count: accounts.length,
    data: accounts,
  });
});

// 15. استرجاع قائمة المرضى للوحة تحكم الـ Staff مع البحث والفلترة وترقيم الصفحات وإحصائيات الحجوزات
const listPatients = asyncHandler(async (req, res) => {
  const { page, limit, query, search, accountStatus, startDate, endDate, sortBy, order } = req.query;
  const searchTerm = (query || search || '').trim();

  const pageNumber = Math.max(1, parseInt(page, 10) || 1);
  const pageSize = Math.min(Math.max(1, parseInt(limit, 10) || 20), 100);
  const skip = (pageNumber - 1) * pageSize;

  let filter = { role: 'Patient' };

  if (accountStatus) {
    filter.accountStatus = accountStatus;
  }

  if (searchTerm) {
    filter.$or = [
      { name: { $regex: searchTerm, $options: 'i' } },
      { email: { $regex: searchTerm, $options: 'i' } },
      { phoneNumber: { $regex: searchTerm, $options: 'i' } },
      { address: { $regex: searchTerm, $options: 'i' } },
    ];
  }

  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) {
      filter.createdAt.$gte = new Date(startDate);
    }
    if (endDate) {
      filter.createdAt.$lte = new Date(endDate);
    }
  }

  const sortField = sortBy === 'name' ? 'name' : 'createdAt';
  const sortDirection = order === 'asc' ? 1 : -1;

  const [totalPatients, patients] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter)
      .select('-passwordHash -resetPasswordTokenHash')
      .sort({ [sortField]: sortDirection })
      .skip(skip)
      .limit(pageSize)
      .lean(),
  ]);

  const patientIds = patients.map((p) => p._id);

  // حساب ملخص الحجوزات لكل مريض في الصفحة الحالية
  let bookingStatsMap = {};
  if (patientIds.length > 0) {
    const [doctorStats, nursingStats] = await Promise.all([
      Booking.aggregate([
        { $match: { patientId: { $in: patientIds } } },
        {
          $group: {
            _id: '$patientId',
            totalDoctorBookings: { $sum: 1 },
            completedDoctorBookings: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
            },
            cancelledDoctorBookings: {
              $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] },
            },
            totalDoctorSpent: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$totalCost', 0] },
            },
            lastDoctorBookingDate: { $max: '$createdAt' },
          },
        },
      ]),
      NursingBooking.aggregate([
        { $match: { patientId: { $in: patientIds } } },
        {
          $group: {
            _id: '$patientId',
            totalNursingBookings: { $sum: 1 },
            completedNursingBookings: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
            },
            cancelledNursingBookings: {
              $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] },
            },
            totalNursingSpent: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$totalCost', 0] },
            },
            lastNursingBookingDate: { $max: '$createdAt' },
          },
        },
      ]),
    ]);

    patientIds.forEach((id) => {
      bookingStatsMap[id.toString()] = {
        totalBookings: 0,
        completedBookings: 0,
        cancelledBookings: 0,
        totalSpent: 0,
        lastBookingDate: null,
      };
    });

    doctorStats.forEach((stat) => {
      const key = stat._id.toString();
      if (bookingStatsMap[key]) {
        bookingStatsMap[key].totalBookings += stat.totalDoctorBookings || 0;
        bookingStatsMap[key].completedBookings += stat.completedDoctorBookings || 0;
        bookingStatsMap[key].cancelledBookings += stat.cancelledDoctorBookings || 0;
        bookingStatsMap[key].totalSpent += stat.totalDoctorSpent || 0;
        bookingStatsMap[key].lastBookingDate = stat.lastDoctorBookingDate;
      }
    });

    nursingStats.forEach((stat) => {
      const key = stat._id.toString();
      if (bookingStatsMap[key]) {
        bookingStatsMap[key].totalBookings += stat.totalNursingBookings || 0;
        bookingStatsMap[key].completedBookings += stat.completedNursingBookings || 0;
        bookingStatsMap[key].cancelledBookings += stat.cancelledNursingBookings || 0;
        bookingStatsMap[key].totalSpent += stat.totalNursingSpent || 0;
        if (
          !bookingStatsMap[key].lastBookingDate ||
          new Date(stat.lastNursingBookingDate) > new Date(bookingStatsMap[key].lastBookingDate)
        ) {
          bookingStatsMap[key].lastBookingDate = stat.lastNursingBookingDate;
        }
      }
    });
  }

  const enrichedPatients = patients.map((p) => {
    const stats = bookingStatsMap[p._id.toString()] || {
      totalBookings: 0,
      completedBookings: 0,
      cancelledBookings: 0,
      totalSpent: 0,
      lastBookingDate: null,
    };
    return {
      ...p,
      stats,
    };
  });

  return res.json({
    success: true,
    count: enrichedPatients.length,
    pagination: {
      total: totalPatients,
      page: pageNumber,
      limit: pageSize,
      totalPages: Math.ceil(totalPatients / pageSize) || 1,
    },
    data: enrichedPatients,
  });
});

// 16. عرض تفاصيل مريض واحد بالكامل مع ملخص وإحصائيات وتاريخ كافة حجوزاته
const getPatientDetailsAndSummary = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'معرف المريض غير صالح' });
  }

  const patient = await User.findOne({ _id: id, role: 'Patient' })
    .select('-passwordHash -resetPasswordTokenHash')
    .lean();

  if (!patient) {
    return res.status(404).json({ success: false, message: 'المريض غير موجود' });
  }

  const [doctorBookings, nursingBookings] = await Promise.all([
    Booking.find({ patientId: id })
      .populate('doctorId', 'name specialization phoneNumber profileImage')
      .populate('nurseId', 'name phoneNumber profileImage')
      .sort({ createdAt: -1 })
      .lean(),
    NursingBooking.find({ patientId: id })
      .populate('nurseId', 'name phoneNumber profileImage')
      .populate('serviceId', 'name basePrice description')
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  const formattedDoctor = doctorBookings.map((b) => ({
    _id: b._id,
    bookingNumber: b.bookingNumber,
    type: 'doctor',
    provider: b.doctorId
      ? {
          _id: b.doctorId._id,
          name: b.doctorId.name,
          type: 'Doctor',
          specialization: b.doctorId.specialization,
          phoneNumber: b.doctorId.phoneNumber,
          profileImage: b.doctorId.profileImage || null,
        }
      : b.nurseId
        ? {
            _id: b.nurseId._id,
            name: b.nurseId.name,
            type: 'Nurse',
            specialization: 'تمريض عام',
            phoneNumber: b.nurseId.phoneNumber,
            profileImage: b.nurseId.profileImage || null,
          }
        : null,
    serviceName: b.doctorId?.specialization || b.suggestedSpecialty || 'كشف طبي',
    appointmentTime: b.appointmentTime,
    requestLocation: b.requestLocation,
    totalCost: b.totalCost || 0,
    status: b.status,
    isReviewed: Boolean(b.isReviewed),
    staffNote: b.staffNote || '',
    createdAt: b.createdAt,
  }));

  const formattedNursing = nursingBookings.map((b) => ({
    _id: b._id,
    bookingNumber: b.bookingNumber,
    type: 'nursing',
    provider: b.nurseId
      ? {
          _id: b.nurseId._id,
          name: b.nurseId.name,
          type: 'Nurse',
          specialization: 'تمريض منزلي',
          phoneNumber: b.nurseId.phoneNumber,
          profileImage: b.nurseId.profileImage || null,
        }
      : null,
    serviceName: b.serviceId?.name || 'خدمة تمريض',
    appointmentTime: b.appointmentTime,
    requestLocation: b.requestLocation,
    totalCost: b.totalCost || (b.serviceId?.basePrice ? Number(b.serviceId.basePrice) : 0),
    status: b.status,
    isReviewed: Boolean(b.isReviewed),
    staffNote: b.staffNote || '',
    createdAt: b.createdAt,
  }));

  const allBookings = [...formattedDoctor, ...formattedNursing].sort(
    (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
  );

  const statusCounts = {
    pending: 0,
    confirmed: 0,
    completed: 0,
    cancelled: 0,
    rejected: 0,
  };

  let totalSpent = 0;
  allBookings.forEach((b) => {
    if (statusCounts[b.status] !== undefined) {
      statusCounts[b.status]++;
    }
    if (b.status === 'completed') {
      totalSpent += b.totalCost || 0;
    }
  });

  const stats = {
    totalBookings: allBookings.length,
    doctorBookingsCount: formattedDoctor.length,
    nursingBookingsCount: formattedNursing.length,
    byStatus: statusCounts,
    totalSpent,
    lastBookingDate: allBookings.length > 0 ? allBookings[0].createdAt : null,
    firstBookingDate: allBookings.length > 0 ? allBookings[allBookings.length - 1].createdAt : null,
  };

  return res.json({
    success: true,
    data: {
      patient,
      stats,
      bookings: allBookings,
    },
  });
});

// 17. تحليلات وإحصائيات شاملة للمرضى (النمو، المسجلين حديثاً، النشاط، والإنفاق)
const getPatientsAnalytics = asyncHandler(async (req, res) => {
  const now = new Date();

  // بداية اليوم 00:00:00 بتوقيت السيرفر
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // بداية الأسبوع (آخر 7 أيام)
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // بداية الشهر (آخر 30 يوماً)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // آخر 6 شهور للتريند الشهري
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  // آخر 14 يوم للتريند اليومي
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const [
    totalPatients,
    activePatients,
    suspendedPatients,
    registeredToday,
    registeredThisWeek,
    registeredThisMonth,
    recentPatients,
    monthlyTrendAgg,
    dailyTrendAgg,
    doctorBookedPatientIds,
    nursingBookedPatientIds,
    completedDoctorSpendAgg,
    completedNursingSpendAgg,
    topDoctorBookers,
    topNursingBookers,
    cancelledDoctorBookers,
    cancelledNursingBookers,
  ] = await Promise.all([
    User.countDocuments({ role: 'Patient' }),
    User.countDocuments({ role: 'Patient', accountStatus: 'active' }),
    User.countDocuments({ role: 'Patient', accountStatus: 'suspended' }),
    User.countDocuments({ role: 'Patient', createdAt: { $gte: startOfToday } }),
    User.countDocuments({ role: 'Patient', createdAt: { $gte: sevenDaysAgo } }),
    User.countDocuments({ role: 'Patient', createdAt: { $gte: thirtyDaysAgo } }),
    User.find({ role: 'Patient' })
      .select('_id name email phoneNumber address accountStatus profileImage createdAt')
      .sort({ createdAt: -1 })
      .limit(8)
      .lean(),
    User.aggregate([
      { $match: { role: 'Patient', createdAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    User.aggregate([
      { $match: { role: 'Patient', createdAt: { $gte: fourteenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Booking.distinct('patientId'),
    NursingBooking.distinct('patientId'),
    Booking.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$totalCost' } } },
    ]),
    NursingBooking.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$totalCost' } } },
    ]),
    Booking.aggregate([
      {
        $group: {
          _id: '$patientId',
          bookingsCount: { $sum: 1 },
          completedBookings: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
          },
          totalSpent: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$totalCost', 0] },
          },
        },
      },
      { $sort: { bookingsCount: -1 } },
      { $limit: 10 },
    ]),
    NursingBooking.aggregate([
      {
        $group: {
          _id: '$patientId',
          bookingsCount: { $sum: 1 },
          completedBookings: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
          },
          totalSpent: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$totalCost', 0] },
          },
        },
      },
      { $sort: { bookingsCount: -1 } },
      { $limit: 10 },
    ]),
    Booking.aggregate([
      { $match: { status: 'cancelled' } },
      {
        $group: {
          _id: '$patientId',
          cancelledCount: { $sum: 1 },
          lastCancelledAt: { $max: '$updatedAt' },
        },
      },
      { $sort: { cancelledCount: -1 } },
      { $limit: 15 },
    ]),
    NursingBooking.aggregate([
      { $match: { status: 'cancelled' } },
      {
        $group: {
          _id: '$patientId',
          cancelledCount: { $sum: 1 },
          lastCancelledAt: { $max: '$updatedAt' },
        },
      },
      { $sort: { cancelledCount: -1 } },
      { $limit: 15 },
    ]),
  ]);

  // دمج معرفات المرضى الذين قاموا بالحجز لحساب نسبة التحويل
  const allBookedPatientIdStrings = new Set([
    ...doctorBookedPatientIds.filter(Boolean).map((id) => id.toString()),
    ...nursingBookedPatientIds.filter(Boolean).map((id) => id.toString()),
  ]);
  const bookedPatients = allBookedPatientIdStrings.size;
  const unbookedPatients = Math.max(0, totalPatients - bookedPatients);
  const conversionRate = totalPatients > 0
    ? Number(((bookedPatients / totalPatients) * 100).toFixed(1))
    : 0;

  // إجمالي الإنفاق ومتوسط إنفاق المريض
  const totalDoctorSpend = completedDoctorSpendAgg[0]?.total || 0;
  const totalNursingSpend = completedNursingSpendAgg[0]?.total || 0;
  const totalPatientSpend = totalDoctorSpend + totalNursingSpend;
  const averageSpendPerPatient = bookedPatients > 0
    ? Math.round(totalPatientSpend / bookedPatients)
    : 0;

  // تجميع أعلى المرضى حجزاً من أطباء وتمريض
  const topPatientsMap = {};
  [...topDoctorBookers, ...topNursingBookers].forEach((item) => {
    if (!item._id) return;
    const key = item._id.toString();
    if (!topPatientsMap[key]) {
      topPatientsMap[key] = {
        patientId: item._id,
        bookingsCount: 0,
        completedBookings: 0,
        totalSpent: 0,
      };
    }
    topPatientsMap[key].bookingsCount += item.bookingsCount || 0;
    topPatientsMap[key].completedBookings += item.completedBookings || 0;
    topPatientsMap[key].totalSpent += item.totalSpent || 0;
  });

  const sortedTopPatientKeys = Object.keys(topPatientsMap)
    .sort((a, b) => topPatientsMap[b].bookingsCount - topPatientsMap[a].bookingsCount)
    .slice(0, 5);

  const topPatientUsers = sortedTopPatientKeys.length > 0
    ? await User.find({ _id: { $in: sortedTopPatientKeys } })
        .select('_id name phoneNumber email profileImage')
        .lean()
    : [];

  const topPatients = sortedTopPatientKeys.map((key) => {
    const user = topPatientUsers.find((u) => u._id.toString() === key);
    return {
      _id: key,
      name: user ? user.name : 'مستخدم',
      phoneNumber: user ? user.phoneNumber : '',
      email: user ? user.email : '',
      profileImage: user ? user.profileImage : null,
      bookingsCount: topPatientsMap[key].bookingsCount,
      completedBookings: topPatientsMap[key].completedBookings,
      totalSpent: topPatientsMap[key].totalSpent,
    };
  });

  // تجميع أعلى المرضى إلغاءً للحجوزات من أطباء وتمريض
  const topCancelledMap = {};
  [...cancelledDoctorBookers, ...cancelledNursingBookers].forEach((item) => {
    if (!item._id) return;
    const key = item._id.toString();
    if (!topCancelledMap[key]) {
      topCancelledMap[key] = {
        patientId: item._id,
        cancelledCount: 0,
        doctorCancelledCount: 0,
        nursingCancelledCount: 0,
        lastCancelledAt: null,
      };
    }
    topCancelledMap[key].cancelledCount += item.cancelledCount || 0;
    if (item.lastCancelledAt) {
      if (
        !topCancelledMap[key].lastCancelledAt ||
        new Date(item.lastCancelledAt) > new Date(topCancelledMap[key].lastCancelledAt)
      ) {
        topCancelledMap[key].lastCancelledAt = item.lastCancelledAt;
      }
    }
  });

  cancelledDoctorBookers.forEach((item) => {
    if (!item._id) return;
    const key = item._id.toString();
    if (topCancelledMap[key]) {
      topCancelledMap[key].doctorCancelledCount += item.cancelledCount || 0;
    }
  });

  cancelledNursingBookers.forEach((item) => {
    if (!item._id) return;
    const key = item._id.toString();
    if (topCancelledMap[key]) {
      topCancelledMap[key].nursingCancelledCount += item.cancelledCount || 0;
    }
  });

  const sortedCancelledKeys = Object.keys(topCancelledMap)
    .sort((a, b) => topCancelledMap[b].cancelledCount - topCancelledMap[a].cancelledCount)
    .slice(0, 10);

  const topCancelledUsers = sortedCancelledKeys.length > 0
    ? await User.find({ _id: { $in: sortedCancelledKeys } })
        .select('_id name phoneNumber email accountStatus profileImage createdAt address')
        .lean()
    : [];

  const topCancelledPatients = sortedCancelledKeys.map((key) => {
    const user = topCancelledUsers.find((u) => u._id.toString() === key);
    return {
      _id: key,
      name: user ? user.name : 'مستخدم',
      phoneNumber: user ? user.phoneNumber : '',
      email: user ? user.email : '',
      address: user ? user.address : '',
      accountStatus: user ? (user.accountStatus || 'active') : 'active',
      profileImage: user ? user.profileImage : null,
      createdAt: user ? user.createdAt : null,
      cancelledCount: topCancelledMap[key].cancelledCount,
      doctorCancelledCount: topCancelledMap[key].doctorCancelledCount,
      nursingCancelledCount: topCancelledMap[key].nursingCancelledCount,
      lastCancelledAt: topCancelledMap[key].lastCancelledAt,
    };
  });

  return res.json({
    success: true,
    data: {
      overview: {
        totalPatients,
        activePatients,
        suspendedPatients,
        bookedPatients,
        unbookedPatients,
        conversionRate,
      },
      growth: {
        registeredToday,
        registeredThisWeek,
        registeredThisMonth,
      },
      financials: {
        totalPatientSpend,
        averageSpendPerPatient,
      },
      recentPatients,
      trends: {
        dailyLast14Days: dailyTrendAgg.map((item) => ({
          date: item._id,
          count: item.count,
        })),
        monthlyLast6Months: monthlyTrendAgg.map((item) => ({
          month: item._id,
          count: item.count,
        })),
      },
      topPatients,
      topCancelledPatients,
    },
  });
});

// 18. تفعيل أو تجميد حساب مريض (Active / Suspended)
const togglePatientStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { accountStatus, reason } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'معرف المريض غير صالح' });
  }

  const patient = await User.findOne({ _id: id, role: 'Patient' });
  if (!patient) {
    return res.status(404).json({ success: false, message: 'المريض غير موجود' });
  }

  const previousStatus = patient.accountStatus || 'active';
  const newStatus = accountStatus
    ? accountStatus
    : previousStatus === 'active'
      ? 'suspended'
      : 'active';

  if (!['active', 'suspended'].includes(newStatus)) {
    return res.status(400).json({
      success: false,
      message: 'حالة الحساب يجب أن تكون إما active أو suspended',
    });
  }

  patient.accountStatus = newStatus;
  await patient.save();

  await logAuditEvent({
    actorId: req.user.id || req.user._id,
    actorRole: req.user.role,
    action: `PATIENT_STATUS_${newStatus.toUpperCase()}`,
    entityId: patient._id,
    entityType: 'User',
    before: { accountStatus: previousStatus },
    after: { accountStatus: newStatus },
    meta: { reason: reason || '', patientName: patient.name, patientPhone: patient.phoneNumber },
  });

  return res.json({
    success: true,
    message: `تم تغيير حالة حساب المريض بنجاح إلى ${newStatus === 'active' ? 'نشط (Active)' : 'موقوف (Suspended)'}`,
    data: {
      _id: patient._id,
      name: patient.name,
      phoneNumber: patient.phoneNumber,
      accountStatus: patient.accountStatus,
    },
  });
});

// 19. عرض قائمة المرضى الأكثر إلغاءً للحجوزات لمراقبتهم وتجميد حساباتهم عند اللزوم
const getMostCancelledPatients = asyncHandler(async (req, res) => {
  const { limit, minCancellations, accountStatus, search, query } = req.query;
  const maxLimit = Math.min(Math.max(1, parseInt(limit, 10) || 20), 100);
  const minCancel = Math.max(1, parseInt(minCancellations, 10) || 1);
  const searchTerm = (search || query || '').trim();

  // 1. تجميع الحجوزات الملغاة من الأطباء والتمريض
  const [cancelledDoctors, cancelledNursing] = await Promise.all([
    Booking.aggregate([
      { $match: { status: 'cancelled' } },
      {
        $group: {
          _id: '$patientId',
          cancelledCount: { $sum: 1 },
          lastCancelledAt: { $max: '$updatedAt' },
        },
      },
      { $sort: { cancelledCount: -1 } },
      { $limit: 200 },
    ]),
    NursingBooking.aggregate([
      { $match: { status: 'cancelled' } },
      {
        $group: {
          _id: '$patientId',
          cancelledCount: { $sum: 1 },
          lastCancelledAt: { $max: '$updatedAt' },
        },
      },
      { $sort: { cancelledCount: -1 } },
      { $limit: 200 },
    ]),
  ]);

  const cancelledMap = {};
  [...cancelledDoctors, ...cancelledNursing].forEach((item) => {
    if (!item._id) return;
    const key = item._id.toString();
    if (!cancelledMap[key]) {
      cancelledMap[key] = {
        cancelledCount: 0,
        doctorCancelledCount: 0,
        nursingCancelledCount: 0,
        lastCancelledAt: null,
      };
    }
    cancelledMap[key].cancelledCount += item.cancelledCount || 0;
    if (item.lastCancelledAt) {
      if (
        !cancelledMap[key].lastCancelledAt ||
        new Date(item.lastCancelledAt) > new Date(cancelledMap[key].lastCancelledAt)
      ) {
        cancelledMap[key].lastCancelledAt = item.lastCancelledAt;
      }
    }
  });

  cancelledDoctors.forEach((item) => {
    if (!item._id) return;
    const key = item._id.toString();
    if (cancelledMap[key]) {
      cancelledMap[key].doctorCancelledCount += item.cancelledCount || 0;
    }
  });

  cancelledNursing.forEach((item) => {
    if (!item._id) return;
    const key = item._id.toString();
    if (cancelledMap[key]) {
      cancelledMap[key].nursingCancelledCount += item.cancelledCount || 0;
    }
  });

  // تصفية المعرفات حسب الحد الأدنى للإلغاءات
  const eligiblePatientIds = Object.keys(cancelledMap)
    .filter((key) => cancelledMap[key].cancelledCount >= minCancel);

  if (eligiblePatientIds.length === 0) {
    return res.json({
      success: true,
      count: 0,
      data: [],
    });
  }

  // بناء استعلام المستخدمين
  let userQuery = {
    _id: { $in: eligiblePatientIds },
    role: 'Patient',
  };

  if (accountStatus && ['active', 'suspended'].includes(accountStatus)) {
    userQuery.accountStatus = accountStatus;
  }

  if (searchTerm) {
    userQuery.$or = [
      { name: { $regex: searchTerm, $options: 'i' } },
      { phoneNumber: { $regex: searchTerm, $options: 'i' } },
      { email: { $regex: searchTerm, $options: 'i' } },
    ];
  }

  const users = await User.find(userQuery)
    .select('_id name phoneNumber email address accountStatus profileImage createdAt')
    .lean();

  const userIds = users.map((u) => u._id);

  if (userIds.length === 0) {
    return res.json({
      success: true,
      count: 0,
      data: [],
    });
  }

  // جلب إجمالي الحجوزات والمكتملة لهؤلاء المرضى لحساب معدل الإلغاء بدقة
  const [docTotalAgg, nurseTotalAgg] = await Promise.all([
    Booking.aggregate([
      { $match: { patientId: { $in: userIds } } },
      {
        $group: {
          _id: '$patientId',
          total: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
        },
      },
    ]),
    NursingBooking.aggregate([
      { $match: { patientId: { $in: userIds } } },
      {
        $group: {
          _id: '$patientId',
          total: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
        },
      },
    ]),
  ]);

  const bookingTotalsMap = {};
  userIds.forEach((id) => {
    bookingTotalsMap[id.toString()] = { total: 0, completed: 0 };
  });
  docTotalAgg.forEach((d) => {
    const key = d._id.toString();
    if (bookingTotalsMap[key]) {
      bookingTotalsMap[key].total += d.total || 0;
      bookingTotalsMap[key].completed += d.completed || 0;
    }
  });
  nurseTotalAgg.forEach((n) => {
    const key = n._id.toString();
    if (bookingTotalsMap[key]) {
      bookingTotalsMap[key].total += n.total || 0;
      bookingTotalsMap[key].completed += n.completed || 0;
    }
  });

  const enriched = users.map((user) => {
    const key = user._id.toString();
    const cancelInfo = cancelledMap[key] || {
      cancelledCount: 0,
      doctorCancelledCount: 0,
      nursingCancelledCount: 0,
      lastCancelledAt: null,
    };
    const totals = bookingTotalsMap[key] || { total: 0, completed: 0 };
    const cancellationRate = totals.total > 0
      ? Number(((cancelInfo.cancelledCount / totals.total) * 100).toFixed(1))
      : 0;

    return {
      _id: user._id,
      name: user.name,
      phoneNumber: user.phoneNumber,
      email: user.email,
      address: user.address,
      accountStatus: user.accountStatus || 'active',
      profileImage: user.profileImage || null,
      createdAt: user.createdAt,
      stats: {
        cancelledBookings: cancelInfo.cancelledCount,
        doctorCancelledBookings: cancelInfo.doctorCancelledCount,
        nursingCancelledBookings: cancelInfo.nursingCancelledCount,
        totalBookings: totals.total,
        completedBookings: totals.completed,
        cancellationRate,
        lastCancelledAt: cancelInfo.lastCancelledAt,
      },
    };
  });

  enriched.sort((a, b) => b.stats.cancelledBookings - a.stats.cancelledBookings);

  const finalData = enriched.slice(0, maxLimit);

  return res.json({
    success: true,
    count: finalData.length,
    data: finalData,
  });
});

module.exports = {
  listAllBookings, cancelBookingHandler, cancelBookingByNumberHandler,
  getCompletedBookingsForSettlement, settleBookings, getBookingDetails,
  getProviderFinancialSummary, updateBookingByAdmin, providerAvailability,
  doctorsStatus, nursesStatus, analytics, toggleProviderStatus, createDoctor, updateDoctor, updateNurse, createNurse,
  listNursingServices, createNursingService, updateNursingService,
  listAuditLogsHandler, createStaffOrAdmin,
  searchUsersForStaff, listDoctorsForStaff, listNursesForStaff,
  listStaffAccounts,
  listPatients, getPatientDetailsAndSummary, getPatientsAnalytics, togglePatientStatus,
  getMostCancelledPatients
};
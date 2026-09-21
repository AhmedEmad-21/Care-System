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
const { normalizeGeoPoint } = require('../utils/geoPoint');

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
    .populate('doctorId', 'name specialization description')
    .populate('nurseId', 'name description')
    .sort({ createdAt: -1 })
    .limit(limit ? Number(limit) : 50)
    .lean();

  const formattedBookings = bookings.map((b) => ({
    ...b,
    isReviewed: Boolean(b.isReviewed),
  }));

  return res.json({
    success: true,
    count: formattedBookings.length,
    data: formattedBookings,
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

module.exports = {
  listAllBookings, cancelBookingHandler, cancelBookingByNumberHandler,
  getCompletedBookingsForSettlement, settleBookings, getBookingDetails,
  getProviderFinancialSummary, updateBookingByAdmin, providerAvailability,
  doctorsStatus, nursesStatus, analytics, toggleProviderStatus, createDoctor, updateDoctor, updateNurse, createNurse,
  listNursingServices, createNursingService, updateNursingService,
  listAuditLogsHandler, createStaffOrAdmin,
  searchUsersForStaff, listDoctorsForStaff, listNursesForStaff,
  listStaffAccounts
};
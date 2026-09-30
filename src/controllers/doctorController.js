const mongoose = require('mongoose');
const asyncHandler = require('../utils/asyncHandler');
const Doctor = require('../models/doctorModel');
const User = require('../models/userModel');
const { normalizeGeoPoint } = require('../utils/geoPoint');
const { logAuditEvent } = require('../services/auditLogService');
const {
  buildNameFilter,
  findByNameWithOptionalGeo,
  withOptionalDateFilter
} = require('../utils/nameSearch');

const { getTodayDateString } = require('../utils/dateUtils');

const formatDoctorPrice = (doc) => {
  if (!doc) return doc;
  const basePrice = doc.basePrice != null ? Number(doc.basePrice) : 0;
  const urgentPrice = (doc.urgentPrice != null && Number(doc.urgentPrice) > 0)
    ? Number(doc.urgentPrice)
    : basePrice;

  const todayStr = getTodayDateString();
  const todayDay = new Date().getDay();
  const unavailableDates = Array.isArray(doc.unavailableDates) ? doc.unavailableDates : [];
  const offDays = Array.isArray(doc.offDays) ? doc.offDays : [];
  const isAvailableToday = Boolean(doc.isAvailable) &&
    !unavailableDates.includes(todayStr) &&
    !offDays.includes(todayDay);

  const { userId, ...rest } = doc;

  return {
    ...rest,
    description: doc.description || '',
    basePrice,
    urgentPrice,
    isAvailableToday
  };
};

const listDoctors = asyncHandler(async (req, res) => {
  const { date } = req.query;
  const targetDate = date ? new Date(date) : new Date();
  const targetDateStr = getTodayDateString(targetDate);
  const targetDay = targetDate.getDay();

  let filter = {
    ...req.filterCriteria,
    isAvailable: true,
    offDays: { $ne: targetDay },
    unavailableDates: { $ne: targetDateStr }
  };

  const doctors = await Doctor.find(filter).select('-userId').lean();
  return res.json({ success: true, data: doctors.map(formatDoctorPrice) });
});

const getDoctorById = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ success: false, message: 'معرف الطبيب غير صالح' });
  }
  const doctor = await Doctor.findById(req.params.id).select('-userId').lean();
  if (!doctor) {
    return res.status(404).json({ success: false, message: 'Doctor not found' });
  }
  return res.json({ success: true, data: formatDoctorPrice(doctor) });
});

// جلب الملف الشخصي للطبيب المسجل حالياً
const getDoctorProfile = asyncHandler(async (req, res) => {
  const currentUserId = req.user.id || req.user._id;
  let doctor = await Doctor.findOne({ userId: currentUserId }).lean();
  if (!doctor && req.user.phoneNumber) {
    doctor = await Doctor.findOne({ phoneNumber: req.user.phoneNumber }).lean();
  }
  if (!doctor) {
    return res.status(404).json({ success: false, message: 'لم يتم العثور على ملف طبيب مرتبط بهذا الحساب' });
  }

  const user = await User.findById(doctor.userId || currentUserId).select('email').lean();
  const formatted = formatDoctorPrice(doctor);
  if (user?.email) {
    formatted.email = user.email;
  }

  return res.json({ success: true, data: formatted });
});

const listAvailableDoctors = asyncHandler(async (req, res) => {
  const { specialty, lat, long, date } = req.query;
  const userCoordinates = [parseFloat(long), parseFloat(lat)]; // [longitude, latitude]

  const targetDate = date ? new Date(date) : new Date();
  const targetDay = targetDate.getDay();
  const targetDateStr = getTodayDateString(targetDate);

  const doctors = await Doctor.aggregate([
    {
      $geoNear: {
        near: { type: "Point", coordinates: userCoordinates },
        distanceField: "dist.calculated",
        spherical: true,
        maxDistance: 35000, // <--- تم تحديد نطاق البحث بـ 35 كم ليناسب محافظة الفيوم
        query: {
          specialization: specialty,
          isAvailable: true,
          offDays: { $ne: targetDay },
          unavailableDates: { $ne: targetDateStr }
        }
      }
    }
  ]);

  return res.json({
    success: true,
    count: doctors.length,
    data: doctors.map(formatDoctorPrice)
  });
});

const getSpecializations = asyncHandler(async (req, res) => {
  // تجميع التخصصات للأطباء المتاحين فقط لتجنب إظهار تخصصات لدكاترة غير مفعلين
  const specializations = await Doctor.distinct('specialization', { isAvailable: true });

  return res.json({
    success: true,
    count: specializations.length,
    data: specializations
  });
});

const searchDoctorsByName = asyncHandler(async (req, res) => {
  const { name, specialization, lat, long, date } = req.query;
  const nameFilter = buildNameFilter(name);

  if (!nameFilter) {
    return res.status(400).json({
      success: false,
      message: 'يرجى إدخال اسم الدكتور للبحث عنه'
    });
  }

  let doctorFilter = {
    isAvailable: true,
    ...nameFilter
  };

  if (specialization) {
    doctorFilter.specialization = specialization;
  }

  doctorFilter = withOptionalDateFilter(doctorFilter, date);

  const doctors = await findByNameWithOptionalGeo(Doctor, doctorFilter, { lat, long });

  return res.json({
    success: true,
    count: doctors.length,
    data: doctors.map(formatDoctorPrice)
  });
});

// Endpoint الفلترة المرنة (تخصص، تاريخ، موقع - منفردين أو مجتمعين بدون اسم)
const filterDoctors = asyncHandler(async (req, res) => {
  const { specialization, date, lat, long } = req.query;
  const targetDate = date ? new Date(date) : new Date();
  const targetDay = targetDate.getDay();
  const targetDateStr = getTodayDateString(targetDate);

  let query = {
    isAvailable: true,
    offDays: { $ne: targetDay },
    unavailableDates: { $ne: targetDateStr }
  };

  if (specialization) {
    query.specialization = specialization;
  }

  if (lat && long) {
    const userCoordinates = [parseFloat(long), parseFloat(lat)];

    if (isNaN(userCoordinates[0]) || isNaN(userCoordinates[1])) {
      return res.status(400).json({
        success: false,
        message: 'إحداثيات الموقع غير صالحة'
      });
    }

    const doctors = await Doctor.aggregate([
      {
        $geoNear: {
          near: { type: "Point", coordinates: userCoordinates },
          distanceField: "dist.calculated",
          spherical: true,
          maxDistance: 35000,
          query: query
        }
      },
      {
        $project: {
          userId: 0
        }
      }
    ]);

    return res.json({
      success: true,
      count: doctors.length,
      data: doctors.map(formatDoctorPrice)
    });
  }

  const doctors = await Doctor.find(query)
    .select('-userId')
    .lean();

  return res.json({
    success: true,
    count: doctors.length,
    data: doctors.map(formatDoctorPrice)
  });
});

// تحديث وصف الطبيب (للطبيب نفسه)
const updateMyDoctorDescription = asyncHandler(async (req, res) => {
  const { description } = req.body;
  const rawId = req.user.id || req.user._id;

  let doctor = await Doctor.findOne({ userId: rawId });
  if (!doctor && req.user.phoneNumber) {
    doctor = await Doctor.findOne({ phoneNumber: req.user.phoneNumber });
  }

  if (!doctor) {
    return res.status(404).json({ success: false, message: 'لم يتم العثور على ملف طبيب مرتبط بهذا الحساب' });
  }

  doctor.description = typeof description === 'string' ? description.trim() : '';
  await doctor.save();

  return res.json({
    success: true,
    message: 'تم تحديث وصف الطبيب بنجاح',
    data: formatDoctorPrice(doctor.toObject())
  });
});

// تحديث وصف الطبيب بمعرف الطبيب (للأدمن أو الاستاف)
const updateDoctorDescriptionById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { description } = req.body;

  const doctor = await Doctor.findByIdAndUpdate(
    id,
    { description: typeof description === 'string' ? description.trim() : '' },
    { new: true }
  ).lean();

  if (!doctor) {
    return res.status(404).json({ success: false, message: 'الطبيب غير موجود' });
  }

  return res.json({
    success: true,
    message: 'تم تحديث وصف الطبيب بنجاح',
    data: formatDoctorPrice(doctor)
  });
});

// تحديث الملف الشخصي وبيانات الطبيب (متاح للطبيب نفسه وللاستاف والأدمن)
const updateDoctorProfile = asyncHandler(async (req, res) => {
  const currentUserId = req.user.id || req.user._id;
  const currentUserRole = String(req.user.role || '').toUpperCase();
  const paramId = req.params.id;

  let doctor = null;

  // 1. تحديد الطبيب المراد تعديله والتحقق من الصلاحيات
  if (!paramId || paramId === 'profile') {
    doctor = await Doctor.findOne({ userId: currentUserId });
    if (!doctor && req.user.phoneNumber) {
      doctor = await Doctor.findOne({ phoneNumber: req.user.phoneNumber });
      if (doctor && !doctor.userId) {
        doctor.userId = currentUserId;
      }
    }
  } else {
    if (!mongoose.Types.ObjectId.isValid(paramId)) {
      return res.status(400).json({ success: false, message: 'معرف الطبيب غير صالح' });
    }

    doctor = await Doctor.findById(paramId);
    if (!doctor) {
      doctor = await Doctor.findOne({ userId: paramId });
    }

    if (!doctor) {
      return res.status(404).json({ success: false, message: 'الطبيب غير موجود' });
    }

    // إذا كان المستخدم الحالي Doctor، يتأكد أنه يعدل ملفه الشخصي فقط
    if (currentUserRole === 'DOCTOR') {
      const isOwner =
        (doctor.userId && doctor.userId.toString() === currentUserId.toString()) ||
        doctor._id.toString() === currentUserId.toString() ||
        (doctor.phoneNumber && req.user.phoneNumber && doctor.phoneNumber === req.user.phoneNumber);

      if (!isOwner) {
        return res.status(403).json({
          success: false,
          message: 'غير مصرح لك بتعديل بيانات طبيب آخر',
        });
      }
    }
  }

  if (!doctor) {
    return res.status(404).json({
      success: false,
      message: 'لم يتم العثور على ملف طبيب مرتبط بهذا الحساب',
    });
  }

  // 2. تجهيز التعديلات
  const updates = { ...req.body };

  // حماية: الطبيب لا يمكنه تعديل نسبة العمولة أو التقييمات
  if (currentUserRole === 'DOCTOR') {
    delete updates.commissionRate;
    delete updates.rating;
    delete updates.totalReviews;
  }

  if (updates.location) {
    updates.location = normalizeGeoPoint(updates.location, 'location');
  }

  // معالجة وتأكيد أسعار الكشف (basePrice و urgentPrice مع دعم price كـ alias)
  if (updates.price !== undefined && updates.basePrice === undefined) {
    updates.basePrice = updates.price;
  }
  delete updates.price;

  if (updates.basePrice !== undefined) {
    const parsedBase = Number(updates.basePrice);
    if (isNaN(parsedBase) || parsedBase < 0) {
      return res.status(400).json({ success: false, message: 'سعر الكشف الأساسي (basePrice) يجب أن يكون رقماً موجباً' });
    }
    updates.basePrice = parsedBase;
  }

  if (updates.urgentPrice !== undefined) {
    const parsedUrgent = Number(updates.urgentPrice);
    if (isNaN(parsedUrgent) || parsedUrgent < 0) {
      return res.status(400).json({ success: false, message: 'سعر الكشف المستعجل (urgentPrice) يجب أن يكون رقماً موجباً' });
    }
    updates.urgentPrice = parsedUrgent;
  }

  // 3. التحقق من عدم تكرار البريد أو الهاتف
  if (updates.email) {
    const emailNorm = updates.email.toLowerCase().trim();
    const query = doctor.userId ? { email: emailNorm, _id: { $ne: doctor.userId } } : { email: emailNorm };
    const existingUser = await User.findOne(query);
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'البريد الإلكتروني مستخدم بالفعل لحساب آخر' });
    }
  }

  if (updates.phoneNumber && updates.phoneNumber !== doctor.phoneNumber) {
    const existingDoc = await Doctor.findOne({
      phoneNumber: updates.phoneNumber,
      _id: { $ne: doctor._id },
    });
    if (existingDoc) {
      return res.status(409).json({ success: false, message: 'رقم الهاتف مسجل بالفعل لطبيب آخر' });
    }
    const userQuery = doctor.userId ? { phoneNumber: updates.phoneNumber, _id: { $ne: doctor.userId } } : { phoneNumber: updates.phoneNumber };
    const existingUser = await User.findOne(userQuery);
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'رقم الهاتف مسجل بالفعل لحساب آخر' });
    }
  }

  // 4. تطبيق التعديلات
  Object.assign(doctor, updates);
  await doctor.save();

  // 5. مزامنة بيانات المستخدم المرتبط
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

  // 6. تسجيل الحدث
  if (currentUserRole === 'STAFF' || currentUserRole === 'ADMIN') {
    await logAuditEvent({
      actorId: currentUserId,
      actorRole: req.user.role,
      action: 'UPDATE_DOCTOR',
      entityId: doctor._id,
      entityType: 'Doctor',
      meta: { updates },
    });
  }

  const responseData = formatDoctorPrice(doctor.toObject ? doctor.toObject() : doctor);
  if (updates.email) {
    responseData.email = updates.email.toLowerCase().trim();
  } else if (doctor.userId) {
    const linkedUser = await User.findById(doctor.userId).select('email').lean();
    if (linkedUser?.email) responseData.email = linkedUser.email;
  }

  return res.json({
    success: true,
    message: 'تم تحديث بيانات الطبيب بنجاح',
    data: responseData,
  });
});

module.exports = {
  listDoctors,
  getDoctorById,
  getDoctorProfile,
  listAvailableDoctors,
  getSpecializations,
  searchDoctorsByName,
  filterDoctors,
  updateMyDoctorDescription,
  updateDoctorDescriptionById,
  updateDoctorProfile
};
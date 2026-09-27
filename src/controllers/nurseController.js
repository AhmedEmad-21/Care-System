const mongoose = require('mongoose');
const asyncHandler = require('../utils/asyncHandler');
const Nurse = require('../models/nurseModel');
const User = require('../models/userModel');
const { normalizeGeoPoint } = require('../utils/geoPoint');
const { logAuditEvent } = require('../services/auditLogService');
const {
  buildNameFilter,
  findByNameWithOptionalGeo,
  withOptionalDateFilter
} = require('../utils/nameSearch');

const { getTodayDateString } = require('../utils/dateUtils');

const formatNurse = (doc) => {
  if (!doc) return doc;
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
    isAvailableToday
  };
};

// 1. عرض الممرضين (القائمة الكاملة مع فلترة المتاحين اليوم أو في تاريخ محدد)
const listNurses = asyncHandler(async (req, res) => {
  const { date } = req.query;
  const targetDate = date ? new Date(date) : new Date();
  const targetDateStr = getTodayDateString(targetDate);
  const targetDay = targetDate.getDay();

  const filter = {
    isAvailable: true,
    offDays: { $ne: targetDay },
    unavailableDates: { $ne: targetDateStr }
  };

  const nurses = await Nurse.find(filter).select('-userId').lean();
  return res.json({ success: true, data: nurses.map(formatNurse) });
});

// 2. عرض تفاصيل ممرض واحد
const getNurseById = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ success: false, message: 'معرف الممرض غير صالح' });
  }
  const nurse = await Nurse.findById(req.params.id).select('-userId').lean();
  if (!nurse) return res.status(404).json({ success: false, message: 'Nurse not found' });
  return res.json({ success: true, data: formatNurse(nurse) });
});

// جلب الملف الشخصي للممرض المسجل حالياً
const getNurseProfile = asyncHandler(async (req, res) => {
  const currentUserId = req.user.id || req.user._id;
  let nurse = await Nurse.findOne({ userId: currentUserId }).lean();
  if (!nurse && req.user.phoneNumber) {
    nurse = await Nurse.findOne({ phoneNumber: req.user.phoneNumber }).lean();
  }
  if (!nurse) {
    return res.status(404).json({ success: false, message: 'لم يتم العثور على ملف ممرض مرتبط بهذا الحساب' });
  }

  const user = await User.findById(nurse.userId || currentUserId).select('email').lean();
  const formatted = formatNurse(nurse);
  if (user?.email) {
    formatted.email = user.email;
  }

  return res.json({ success: true, data: formatted });
});

// 3. البحث عن ممرضين حسب الموقع والخدمة
const listNursesByService = asyncHandler(async (req, res) => {
  const { date } = req.query;
  let lng = req.query.lng || req.query.long;
  let lat = req.query.lat;

  if ((!lng || !lat) && req.query.requestLocation) {
    try {
      const parsedLoc = JSON.parse(req.query.requestLocation);
      if (parsedLoc.coordinates && parsedLoc.coordinates.length === 2) {
        lng = parsedLoc.coordinates[0];
        lat = parsedLoc.coordinates[1];
      }
    } catch (e) {}
  }

  if ((!lng || !lat) && req.user?.location?.coordinates) {
    const [userLng, userLat] = req.user.location.coordinates;
    if (Number.isFinite(userLng) && Number.isFinite(userLat)) {
      lng = userLng;
      lat = userLat;
    }
  }

  if (lng === undefined || lat === undefined || isNaN(lng) || isNaN(lat)) {
    return res.status(400).json({ 
      success: false, 
      message: 'Longitude (lng) and Latitude (lat) are required and must be valid numbers, or user location must be saved in the account profile.' 
    });
  }

  let targetDate = new Date();
  if (date) {
    const parsed = new Date(date);
    if (!isNaN(parsed.getTime())) {
      targetDate = parsed;
    }
  }
  const dayOfWeek = targetDate.getDay();
  const targetDateStr = getTodayDateString(targetDate);
  
  const query = {
    isAvailable: true,
    offDays: { $ne: dayOfWeek },
    unavailableDates: { $ne: targetDateStr }
  };

  const nurses = await Nurse.aggregate([
    { 
      $geoNear: { 
        near: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] }, 
        distanceField: 'dist', 
        spherical: true, 
        maxDistance: 40000, 
        query 
      } 
    },
    { $limit: 20 }
  ]);
  
  return res.json({ 
    success: true, 
    count: nurses.length, 
    data: nurses.map(formatNurse) 
  });
});

const searchNursesByName = asyncHandler(async (req, res) => {
  const { name, lat, long, date } = req.query;
  const nameFilter = buildNameFilter(name);

  if (!nameFilter) {
    return res.status(400).json({
      success: false,
      message: 'يرجى إدخال اسم الممرض للبحث عنه'
    });
  }

  const nurseFilter = withOptionalDateFilter(
    {
      isAvailable: true,
      ...nameFilter
    },
    date
  );

  const nurses = await findByNameWithOptionalGeo(Nurse, nurseFilter, { lat, long });

  return res.json({
    success: true,
    count: nurses.length,
    data: nurses.map(formatNurse)
  });
});

// Endpoint الفلترة المرنة للممرضين (تاريخ، موقع - منفردين أو مع بعض بدون اسم)
const filterNurses = asyncHandler(async (req, res) => {
  const { date, lat, long } = req.query;
  const targetDate = date ? new Date(date) : new Date();
  const dayOfWeek = targetDate.getDay();
  const targetDateStr = getTodayDateString(targetDate);

  let query = {
    isAvailable: true,
    offDays: { $ne: dayOfWeek },
    unavailableDates: { $ne: targetDateStr }
  };

  if (lat && long) {
    const lngVal = parseFloat(long);
    const latVal = parseFloat(lat);

    if (isNaN(lngVal) || isNaN(latVal)) {
      return res.status(400).json({
        success: false,
        message: 'إحداثيات الموقع غير صالحة'
      });
    }

    const nurses = await Nurse.aggregate([
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [lngVal, latVal] },
          distanceField: 'dist.calculated',
          spherical: true,
          maxDistance: 40000,
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
      count: nurses.length,
      data: nurses.map(formatNurse)
    });
  }

  const nurses = await Nurse.find(query)
    .select('-userId')
    .lean();

  return res.json({
    success: true,
    count: nurses.length,
    data: nurses.map(formatNurse)
  });
});

// تحديث وصف الممرض (للممرض نفسه)
const updateMyNurseDescription = asyncHandler(async (req, res) => {
  const { description } = req.body;
  const rawId = req.user.id || req.user._id;

  let nurse = await Nurse.findOne({ userId: rawId });
  if (!nurse && req.user.phoneNumber) {
    nurse = await Nurse.findOne({ phoneNumber: req.user.phoneNumber });
  }

  if (!nurse) {
    return res.status(404).json({ success: false, message: 'لم يتم العثور على ملف ممرض مرتبط بهذا الحساب' });
  }

  nurse.description = typeof description === 'string' ? description.trim() : '';
  await nurse.save();

  return res.json({
    success: true,
    message: 'تم تحديث وصف الممرض بنجاح',
    data: formatNurse(nurse.toObject())
  });
});

// تحديث وصف الممرض بمعرف الممرض (للأدمن أو الاستاف)
const updateNurseDescriptionById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { description } = req.body;

  const nurse = await Nurse.findByIdAndUpdate(
    id,
    { description: typeof description === 'string' ? description.trim() : '' },
    { new: true }
  ).lean();

  if (!nurse) {
    return res.status(404).json({ success: false, message: 'الممرض غير موجود' });
  }

  return res.json({
    success: true,
    message: 'تم تحديث وصف الممرض بنجاح',
    data: formatNurse(nurse)
  });
});

// تحديث الملف الشخصي وبيانات الممرض (متاح للممرض نفسه وللاستاف والأدمن)
const updateNurseProfile = asyncHandler(async (req, res) => {
  const currentUserId = req.user.id || req.user._id;
  const currentUserRole = String(req.user.role || '').toUpperCase();
  const paramId = req.params.id;

  let nurse = null;

  // 1. تحديد الممرض المراد تعديله والتحقق من الصلاحيات
  if (!paramId || paramId === 'profile') {
    nurse = await Nurse.findOne({ userId: currentUserId });
    if (!nurse && req.user.phoneNumber) {
      nurse = await Nurse.findOne({ phoneNumber: req.user.phoneNumber });
      if (nurse && !nurse.userId) {
        nurse.userId = currentUserId;
      }
    }
  } else {
    if (!mongoose.Types.ObjectId.isValid(paramId)) {
      return res.status(400).json({ success: false, message: 'معرف الممرض غير صالح' });
    }

    nurse = await Nurse.findById(paramId);
    if (!nurse) {
      nurse = await Nurse.findOne({ userId: paramId });
    }

    if (!nurse) {
      return res.status(404).json({ success: false, message: 'الممرض غير موجود' });
    }

    // إذا كان المستخدم الحالي Nurse، يتأكد أنه يعدل ملفه الشخصي فقط
    if (currentUserRole === 'NURSE') {
      const isOwner =
        (nurse.userId && nurse.userId.toString() === currentUserId.toString()) ||
        nurse._id.toString() === currentUserId.toString() ||
        (nurse.phoneNumber && req.user.phoneNumber && nurse.phoneNumber === req.user.phoneNumber);

      if (!isOwner) {
        return res.status(403).json({
          success: false,
          message: 'غير مصرح لك بتعديل بيانات ممرض آخر',
        });
      }
    }
  }

  if (!nurse) {
    return res.status(404).json({
      success: false,
      message: 'لم يتم العثور على ملف ممرض مرتبط بهذا الحساب',
    });
  }

  // 2. تجهيز التعديلات
  const updates = { ...req.body };

  // حماية: الممرض لا يمكنه تعديل نسبة العمولة أو التقييمات
  if (currentUserRole === 'NURSE') {
    delete updates.commissionRate;
    delete updates.rating;
    delete updates.totalReviews;
  }

  if (updates.location) {
    updates.location = normalizeGeoPoint(updates.location, 'location');
  }

  // 3. التحقق من عدم تكرار البريد أو الهاتف
  if (updates.email) {
    const emailNorm = updates.email.toLowerCase().trim();
    const query = nurse.userId ? { email: emailNorm, _id: { $ne: nurse.userId } } : { email: emailNorm };
    const existingUser = await User.findOne(query);
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'البريد الإلكتروني مستخدم بالفعل لحساب آخر' });
    }
  }

  if (updates.phoneNumber && updates.phoneNumber !== nurse.phoneNumber) {
    const existingNurse = await Nurse.findOne({
      phoneNumber: updates.phoneNumber,
      _id: { $ne: nurse._id },
    });
    if (existingNurse) {
      return res.status(409).json({ success: false, message: 'رقم الهاتف مسجل بالفعل لممرض آخر' });
    }
    const userQuery = nurse.userId ? { phoneNumber: updates.phoneNumber, _id: { $ne: nurse.userId } } : { phoneNumber: updates.phoneNumber };
    const existingUser = await User.findOne(userQuery);
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'رقم الهاتف مسجل بالفعل لحساب آخر' });
    }
  }

  // 4. تطبيق التعديلات
  Object.assign(nurse, updates);
  await nurse.save();

  // 5. مزامنة بيانات المستخدم المرتبط
  if (nurse.userId) {
    const userUpdates = {};
    if (updates.name) userUpdates.name = updates.name;
    if (updates.email) userUpdates.email = updates.email.toLowerCase().trim();
    if (updates.phoneNumber) userUpdates.phoneNumber = updates.phoneNumber;
    if (updates.address) userUpdates.address = updates.address;
    if (updates.profileImage) userUpdates.profileImage = updates.profileImage;
    if (updates.location) userUpdates.location = updates.location;

    if (Object.keys(userUpdates).length > 0) {
      await User.findByIdAndUpdate(nurse.userId, userUpdates).catch(() => {});
    }
  }

  // 6. تسجيل الحدث
  if (currentUserRole === 'STAFF' || currentUserRole === 'ADMIN') {
    await logAuditEvent({
      actorId: currentUserId,
      actorRole: req.user.role,
      action: 'UPDATE_NURSE',
      entityId: nurse._id,
      entityType: 'Nurse',
      meta: { updates },
    });
  }

  const responseData = formatNurse(nurse.toObject ? nurse.toObject() : nurse);
  if (updates.email) {
    responseData.email = updates.email.toLowerCase().trim();
  } else if (nurse.userId) {
    const linkedUser = await User.findById(nurse.userId).select('email').lean();
    if (linkedUser?.email) responseData.email = linkedUser.email;
  }

  return res.json({
    success: true,
    message: 'تم تحديث بيانات الممرض بنجاح',
    data: responseData,
  });
});

module.exports = {
  listNurses,
  getNurseById,
  getNurseProfile,
  listNursesByService,
  searchNursesByName,
  filterNurses,
  updateMyNurseDescription,
  updateNurseDescriptionById,
  updateNurseProfile
};
const asyncHandler = require('../utils/asyncHandler');
const Nurse = require('../models/nurseModel');
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
  const nurse = await Nurse.findById(req.params.id).select('-userId').lean();
  if (!nurse) return res.status(404).json({ success: false, message: 'Nurse not found' });
  return res.json({ success: true, data: formatNurse(nurse) });
});

// 3. البحث عن ممرضين حسب الموقع والخدمة
const listNursesByService = asyncHandler(async (req, res) => {
  let lng = req.query.lng;
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

  const targetDate = date ? new Date(date) : new Date();
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
  
  return res.json({ success: true, data: nurses });
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

module.exports = {
  listNurses,
  getNurseById,
  listNursesByService,
  searchNursesByName,
  filterNurses,
  updateMyNurseDescription,
  updateNurseDescriptionById
};
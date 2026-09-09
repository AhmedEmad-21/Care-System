const asyncHandler = require('../utils/asyncHandler');
const Nurse = require('../models/nurseModel');
const {
  buildNameFilter,
  findByNameWithOptionalGeo,
  withOptionalDateFilter
} = require('../utils/nameSearch');

// 1. عرض الممرضين (القائمة الكاملة)
const listNurses = asyncHandler(async (req, res) => {
  const nurses = await Nurse.find({ isAvailable: true }).populate('userId');
  return res.json({ success: true, data: nurses });
});

// 2. عرض تفاصيل ممرض واحد
const getNurseById = asyncHandler(async (req, res) => {
  const nurse = await Nurse.findById(req.params.id).populate('userId');
  if (!nurse) return res.status(404).json({ success: false, message: 'Nurse not found' });
  return res.json({ success: true, data: nurse });
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

  const { date } = req.query; 
  const dayOfWeek = date ? new Date(date).getDay() : null;
  
  const query = { isAvailable: true };
  if (dayOfWeek !== null) query.offDays = { $ne: dayOfWeek };

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
    data: nurses
  });
});

// Endpoint الفلترة المرنة للممرضين (تاريخ، موقع - منفردين أو مع بعض بدون اسم)
const filterNurses = asyncHandler(async (req, res) => {
  const { date, lat, long } = req.query;

  let query = { isAvailable: true };

  if (date) {
    const dayOfWeek = new Date(date).getDay();
    query.offDays = { $ne: dayOfWeek };
  }

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
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'userId'
        }
      },
      {
        $unwind: {
          path: '$userId',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          'userId.passwordHash': 0,
          'userId.resetPasswordTokenHash': 0
        }
      }
    ]);

    return res.json({
      success: true,
      count: nurses.length,
      data: nurses
    });
  }

  const nurses = await Nurse.find(query)
    .populate('userId', 'name email phoneNumber profileImage address location')
    .lean();

  return res.json({
    success: true,
    count: nurses.length,
    data: nurses
  });
});

module.exports = {
  listNurses,
  getNurseById,
  listNursesByService,
  searchNursesByName,
  filterNurses
};
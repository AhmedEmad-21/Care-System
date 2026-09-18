const asyncHandler = require('../utils/asyncHandler');
const Doctor = require('../models/doctorModel');
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
  const doctor = await Doctor.findById(req.params.id).select('-userId').lean();
  if (!doctor) {
    return res.status(404).json({ success: false, message: 'Doctor not found' });
  }
  return res.json({ success: true, data: formatDoctorPrice(doctor) });
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

module.exports = { 
  listDoctors, 
  getDoctorById, 
  listAvailableDoctors, 
  getSpecializations, 
  searchDoctorsByName,
  filterDoctors,
  updateMyDoctorDescription,
  updateDoctorDescriptionById
};
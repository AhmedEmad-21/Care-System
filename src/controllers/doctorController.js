const asyncHandler = require('../utils/asyncHandler');
const Doctor = require('../models/doctorModel');
const {
  buildNameFilter,
  findByNameWithOptionalGeo,
  withOptionalDateFilter
} = require('../utils/nameSearch');

const listDoctors = asyncHandler(async (req, res) => {
  const { date } = req.query;
  let filter = { ...req.filterCriteria, isAvailable: true };
  if (date) {
    filter.offDays = { $ne: new Date(date).getDay() };
  }
  const doctors = await Doctor.find(filter).populate('userId', 'name').lean();
  return res.json({ success: true, data: doctors });
});

const getDoctorById = asyncHandler(async (req, res) => {
  const doctor = await Doctor.findById(req.params.id).populate('userId', 'name').lean();
  return res.json({ success: true, data: doctor });
});

const listAvailableDoctors = asyncHandler(async (req, res) => {
  const { specialty, lat, long, date } = req.query; 
  const userCoordinates = [parseFloat(long), parseFloat(lat)]; // [longitude, latitude]
  
  const targetDay = date ? new Date(date).getDay() : new Date().getDay();

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
          offDays: { $ne: targetDay }
        }
      }
    }
  ]);

  return res.json({ 
    success: true, 
    count: doctors.length, 
    data: doctors 
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
    data: doctors
  });
});

module.exports = { 
  listDoctors, 
  getDoctorById, 
  listAvailableDoctors, 
  getSpecializations, 
  searchDoctorsByName 
};
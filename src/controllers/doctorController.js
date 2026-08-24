const asyncHandler = require('../utils/asyncHandler');
const Doctor = require('../models/doctorModel');
const { resolveProfileImage } = require('../utils/profileImage');

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
  const { specialty, lat, long, date } = req.query; // أضفنا date لاستقبال التاريخ من المستخدم
  const userCoordinates = [parseFloat(long), parseFloat(lat)]; // [longitude, latitude]
  
  // نحدد اليوم بناءً على التاريخ المرسل، أو نستخدم اليوم الحالي إذا لم يُرسل تاريخ
  const targetDay = date ? new Date(date).getDay() : new Date().getDay();

  const doctors = await Doctor.aggregate([
    {
      $geoNear: {
        near: { type: "Point", coordinates: userCoordinates },
        distanceField: "dist.calculated",
        spherical: true,
        // الفلترة: التخصص + متاح + ليس يوم إجازة (بناءً على التاريخ المحدد)
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
  // استرجاع كل التخصصات الفريدة الموجودة في مجموعة الدكاترة
  const specializations = await Doctor.distinct('specialization');
  
  return res.json({
    success: true,
    count: specializations.length,
    data: specializations
  });
});
module.exports = { listDoctors, getDoctorById, listAvailableDoctors, getSpecializations };
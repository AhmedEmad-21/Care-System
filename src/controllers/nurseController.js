const asyncHandler = require('../utils/asyncHandler');
const Nurse = require('../models/nurseModel');

// 1. عرض الممرضين (القائمة الكاملة)
const listNurses = asyncHandler(async (req, res) => {
  const nurses = await Nurse.find({ isAvailable: true }).populate('userId');
  return res.json({ success: true, data: nurses });
});

// 2. عرض تفاصيل ممرض واحد (الدالة المفقودة)
const getNurseById = asyncHandler(async (req, res) => {
  const nurse = await Nurse.findById(req.params.id).populate('userId');
  if (!nurse) return res.status(404).json({ success: false, message: 'Nurse not found' });
  return res.json({ success: true, data: nurse });
});

// 3. البحث عن ممرضين حسب الخدمة والموقع
// البحث عن ممرضين حسب الموقع فقط (بدون التقيد بخدمة معينة)
const listNursesByService = asyncHandler(async (req, res) => {
  // إزالة serviceId من الـ params لأنه لم يعد موجوداً في الرابط
  const { lng, lat, date } = req.query; 
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

// تأكد من تصدير جميع الدوال المطلوبة في الـ Routes
module.exports = { 
  listNurses, 
  getNurseById, 
  listNursesByService 
};
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
  // دعم الاستقبال كـ Query Parameters منفصلة أو داخل Object لو متاح
  let lng = req.query.lng;
  let lat = req.query.lat;

  // لو الـ Frontend بيبعت الإحداثيات بطريقة تانية (مثل requestLocation كـ JSON string أو أوبجكت)
  if ((!lng || !lat) && req.query.requestLocation) {
    try {
      const parsedLoc = JSON.parse(req.query.requestLocation);
      if (parsedLoc.coordinates && parsedLoc.coordinates.length === 2) {
        lng = parsedLoc.coordinates[0];
        lat = parsedLoc.coordinates[1];
      }
    } catch (e) {
      // لو مش JSON صالح، تجاهل الخطأ واعتمد على موقع المستخدم من بيانات الحساب
    }
  }

  // fallback الأساسي: استخدم موقع المستخدم المحفوظ في بيانات الحساب لو ماحدش أرسل إحداثيات
  if ((!lng || !lat) && req.user?.location?.coordinates) {
    const [userLng, userLat] = req.user.location.coordinates;
    if (Number.isFinite(userLng) && Number.isFinite(userLat)) {
      lng = userLng;
      lat = userLat;
    }
  }

  // التأكد من وجود الإحداثيات وأنها أرقام سليمة
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

// تأكد من تصدير جميع الدوال المطلوبة في الـ Routes
module.exports = { 
  listNurses, 
  getNurseById, 
  listNursesByService 
};
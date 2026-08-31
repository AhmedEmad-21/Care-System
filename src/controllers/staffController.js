const asyncHandler = require('../utils/asyncHandler');
const Doctor = require('../models/doctorModel');
const Nurse = require('../models/nurseModel');
const NursingService = require('../models/nursingServiceModel');
const Booking = require('../models/bookingModel');
const NursingBooking = require('../models/nursingBookingModel');
const AuditLog = require('../models/auditLogModel');
const { listPendingBookings, updateBookingStatus, cancelBooking } = require('../services/bookingService');
const { logAuditEvent, listAuditLogs } = require('../services/auditLogService');

// 1. جلب الحجوزات المعلقة
const pendingBookings = asyncHandler(async (req, res) => {
  const bookings = await listPendingBookings({ limit: req.query.limit });
  return res.json({ success: true, data: bookings });
});

// 2. تأكيد الحجز
const confirmBooking = asyncHandler(async (req, res) => {
  const booking = await updateBookingStatus({
    bookingId: req.params.id,
    status: 'confirmed',
    appointmentTime: req.body.appointmentTime,
    staffNote: req.body.staffNote,
    confirmedByStaffId: req.user.id || req.user._id,
  });
  return res.json({ success: true, message: 'Booking confirmed', data: booking });
});

// 3. إلغاء الحجز
const cancelBookingHandler = asyncHandler(async (req, res) => {
  const booking = await cancelBooking({
    bookingId: req.params.id,
    staffNote: req.body.staffNote,
    confirmedByStaffId: req.user.id || req.user._id,
  });
  return res.json({ success: true, message: 'Booking cancelled', data: booking });
});



// 6. التحقق من التوافر
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

// 7. جلب حالة الأطباء
const doctorsStatus = asyncHandler(async (req, res) => {
  const doctors = await Doctor.find().lean();
  return res.json({ success: true, data: doctors });
});

// 8. التحليلات
const analytics = asyncHandler(async (req, res) => {
  const [aggTotal, byStatus] = await Promise.all([Booking.countDocuments(), Booking.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }])]);
  return res.json({ success: true, data: { totalBookings: aggTotal, byStatus } });
});

// 9. تفعيل/تعطيل مقدم الخدمة
const toggleProviderStatus = asyncHandler(async (req, res) => {
  const { type, id } = req.params;
  const Model = type === 'doctor' ? Doctor : Nurse;
  const provider = await Model.findById(id);
  if (!provider) return res.status(404).json({ success: false, message: 'Not found' });
  provider.isAvailable = !provider.isAvailable;
  await provider.save();
  return res.json({ success: true, data: { isAvailable: provider.isAvailable } });
});

// 10. إنشاء طبيب جديد (مع تصحيح entityType)
// 10. إنشاء طبيب جديد
const createDoctor = asyncHandler(async (req, res) => {
  try {
    const doctor = await Doctor.create({ ...req.body, addedBy: req.user.id || req.user._id });
    await logAuditEvent({ 
      actorId: req.user.id || req.user._id, 
      actorRole: 'Staff', 
      action: 'CREATE_DOCTOR', 
      entityId: doctor._id, 
      entityType: 'Doctor',
      meta: { name: req.body.name } 
    });
    return res.status(201).json({ success: true, data: doctor });
  } catch (error) {
    if (error.code === 11000) {
      // التحقق من نوع الحقل الذي تسبب في الخطأ
      const isPhoneDuplicate = error.keyValue.phoneNumber;
      const message = isPhoneDuplicate 
        ? 'هذا الطبيب مسجل بالفعل بنفس رقم الهاتف' 
        : 'يوجد طبيب آخر مسجل بالفعل في هذا الموقع الجغرافي بالضبط';
      
      return res.status(409).json({ success: false, message });
    }
    throw error;
  }
});

// 11. تحديث طبيب
const updateDoctor = asyncHandler(async (req, res) => {
  try {
    const doctor = await Doctor.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    return res.json({ success: true, data: doctor });
  } catch (error) {
    if (error.code === 11000) {
      const isPhoneDuplicate = Boolean(error.keyValue?.phoneNumber);
      const message = isPhoneDuplicate
        ? 'هذا الطبيب مسجل بالفعل بنفس رقم الهاتف'
        : 'يوجد طبيب آخر مسجل بالفعل في هذا الموقع الجغرافي بالضبط';

      return res.status(409).json({ success: false, message });
    }
    throw error;
  }
});

// 12. جلب خدمات التمريض
const listNursingServices = asyncHandler(async (req, res) => {
  const services = await NursingService.find().lean();
  return res.json({ success: true, data: services });
});

// 13. إنشاء خدمة تمريض
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
// 14. تحديث خدمة تمريض
const updateNursingService = asyncHandler(async (req, res) => {
  const service = await NursingService.findByIdAndUpdate(req.params.id, req.body, { new: true });
  return res.json({ success: true, data: service });
});

// 15. جلب سجلات التدقيق
const listAuditLogsHandler = asyncHandler(async (req, res) => {
  const logs = await listAuditLogs({ limit: req.query.limit });
  return res.json({ success: true, data: logs });
});

// 16. إنشاء ممرض جديد (مع تصحيح entityType)
// 16. إنشاء ممرض جديد
const createNurse = asyncHandler(async (req, res) => {
  try {
    const nurse = await Nurse.create({ ...req.body, addedBy: req.user.id || req.user._id });
    await logAuditEvent({ 
      actorId: req.user.id || req.user._id, 
      actorRole: 'Staff', 
      action: 'CREATE_NURSE', 
      entityId: nurse._id, 
      entityType: 'Nurse', 
      meta: { name: req.body.name } 
    });
    return res.status(201).json({ success: true, data: nurse });
  } catch (error) {
    if (error.code === 11000) {
      // التحقق من الحقل المسبب للخطأ لإظهار رسالة واضحة
      const isPhoneDuplicate = error.keyValue.phoneNumber;
      const message = isPhoneDuplicate 
        ? 'هذا الممرض مسجل بالفعل بنفس رقم الهاتف' 
        : 'يوجد ممرض آخر مسجل بالفعل في هذا الموقع الجغرافي بالضبط';
      
      return res.status(409).json({ success: false, message });
    }
    throw error;
  }
});

module.exports = {
  pendingBookings, confirmBooking, cancelBookingHandler, providerAvailability, doctorsStatus, analytics,
  toggleProviderStatus, createDoctor, updateDoctor, listNursingServices,
  createNursingService, updateNursingService, listAuditLogsHandler, createNurse
};

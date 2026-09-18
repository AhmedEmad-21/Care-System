const asyncHandler = require('../utils/asyncHandler');
const {
  getProviderBookings,
  scheduleBooking,
  updateBookingStatusService,
  getProviderSettlements,
  updateOffDaysService,
  getTodayAvailabilityService,
  toggleTodayAvailabilityService,
  updateDescriptionService,
  getProviderProfileService
} = require('../services/providerDashboardService');

// جلب الحجوزات مع الفلترة
const listBookings = asyncHandler(async (req, res) => {
  const { status, date } = req.query;
  const bookings = await getProviderBookings({
    userId: req.user.id || req.user._id,
    status,
    date
  });

  return res.json({
    success: true,
    count: bookings.length,
    data: bookings
  });
});

// تعيين موعد محدد للحجز وتأكيده
const setBookingSchedule = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { appointmentTime, status } = req.body;

  const updatedBooking = await scheduleBooking({
    userId: req.user.id || req.user._id,
    bookingId: id,
    appointmentTime,
    status
  });

  return res.json({
    success: true,
    message: 'تم تحديث موعد الحجز بنجاح',
    data: updatedBooking
  });
});

// تغيير حالة الحجز
const changeBookingStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const updatedBooking = await updateBookingStatusService({
    userId: req.user.id || req.user._id,
    bookingId: id,
    status
  });

  return res.json({
    success: true,
    message: 'تم تحديث حالة الحجز بنجاح',
    data: updatedBooking
  });
});

// عرض التسويات المالية (الحجوزات المسوية والمستحقة) مع الفلترة بالتاريخ وحالة التسوية
const listSettlements = asyncHandler(async (req, res) => {
  const { startDate, endDate, isSettled } = req.query;

  const result = await getProviderSettlements({
    userId: req.user.id || req.user._id,
    startDate,
    endDate,
    isSettled
  });

  return res.json({
    success: true,
    count: result.data.length,
    summary: result.summary,
    data: result.data
  });
});

// تحديث أيام الإجازة
const updateOffDays = asyncHandler(async (req, res) => {
  const { offDays } = req.body;

  const provider = await updateOffDaysService({
    userId: req.user.id || req.user._id,
    offDays
  });

  return res.json({
    success: true,
    message: 'تم تحديث أيام الإجازة بنجاح',
    data: provider
  });
});

// جلب حالة استقبال الحجوزات اليوم (معرفة هل الزرار On أو Off)
const getTodayAvailability = asyncHandler(async (req, res) => {
  const data = await getTodayAvailabilityService({
    userId: req.user.id || req.user._id
  });

  return res.json({
    success: true,
    data
  });
});

// تحديث / تبديل حالة استقبال الحجوزات اليومية
const updateTodayAvailability = asyncHandler(async (req, res) => {
  const { isAvailableToday } = req.body;

  const data = await toggleTodayAvailabilityService({
    userId: req.user.id || req.user._id,
    isAvailableToday
  });

  return res.json({
    success: true,
    message: data.isAvailableToday 
      ? 'تم تفعيل استقبال الحجوزات لليوم بنجاح' 
      : 'تم إيقاف استقبال الحجوزات لليوم بنجاح، ولن تظهر في قائمة الحجوزات المتاحة لهذا اليوم',
    data
  });
});

// تحديث الوصف التعريفي لمزود الخدمة
const updateDescription = asyncHandler(async (req, res) => {
  const { description } = req.body;

  const data = await updateDescriptionService({
    userId: req.user.id || req.user._id,
    description
  });

  return res.json({
    success: true,
    message: 'تم تحديث الوصف بنجاح',
    data
  });
});

// جلب بيانات البروفايل لمزود الخدمة في الداش بورد
const getProfile = asyncHandler(async (req, res) => {
  const data = await getProviderProfileService({
    userId: req.user.id || req.user._id
  });

  return res.json({
    success: true,
    data
  });
});

module.exports = {
  listBookings,
  setBookingSchedule,
  changeBookingStatus,
  listSettlements,
  updateOffDays,
  getTodayAvailability,
  updateTodayAvailability,
  updateDescription,
  getProfile
};
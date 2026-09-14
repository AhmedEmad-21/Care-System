const asyncHandler = require('../utils/asyncHandler');
const {
  getProviderBookings,
  scheduleBooking,
  updateBookingStatusService,
  getProviderSettlements,
  updateOffDaysService
} = require('../services/providerDashboardService');

// جلب الحجوزات مع الفلترة
const listBookings = asyncHandler(async (req, res) => {
  const { status, date } = req.query;
  const bookings = await getProviderBookings({
    userId: req.user._id,
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
    userId: req.user._id,
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
    userId: req.user._id,
    bookingId: id,
    status
  });

  return res.json({
    success: true,
    message: 'تم تحديث حالة الحجز بنجاح',
    data: updatedBooking
  });
});

// عرض التسويات المالية المدفوعة مع دعم الفلترة بالتاريخ
const listSettlements = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  const settlements = await getProviderSettlements({
    userId: req.user._id,
    startDate,
    endDate
  });

  return res.json({
    success: true,
    count: settlements.length,
    data: settlements
  });
});

// تحديث أيام الإجازة
const updateOffDays = asyncHandler(async (req, res) => {
  const { offDays } = req.body;

  const provider = await updateOffDaysService({
    userId: req.user._id,
    offDays
  });

  return res.json({
    success: true,
    message: 'تم تحديث أيام الإجازة بنجاح',
    data: provider
  });
});

module.exports = {
  listBookings,
  setBookingSchedule,
  changeBookingStatus,
  listSettlements,
  updateOffDays
};
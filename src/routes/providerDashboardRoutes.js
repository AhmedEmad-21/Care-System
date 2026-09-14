const express = require('express');
const authMW = require('../middlewares/authMW');
const checkRoleMW = require('../middlewares/checkRoleMW');
const controller = require('../controllers/providerDashboardController');

const router = express.Router();

// الحماية والصلاحيات لكل المسارات
router.use(authMW, checkRoleMW('Doctor', 'Nurse'));

// عرض الحجوزات مع إمكانية الفلترة (status أو date)
router.get('/bookings', controller.listBookings);

// جدولة الحجز وتحديد موعد بمعرفة المزود
router.patch('/bookings/:id/schedule', controller.setBookingSchedule);

// تغيير حالة الحجز (completed, cancelled, etc.)
router.patch('/bookings/:id/status', controller.changeBookingStatus);

// عرض الحجوزات المكتملة والمسوية مالياً مع إمكانية الفلترة بالتاريخ (startDate, endDate)
router.get('/settlements', controller.listSettlements);

// تعديل أيام الإجازة الأسبوعية (offDays)
router.patch('/off-days', controller.updateOffDays);

module.exports = router;
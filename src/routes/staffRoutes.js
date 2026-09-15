const express = require('express');
const authMW = require('../middlewares/authMW');
const checkRoleMW = require('../middlewares/checkRoleMW');
const validateAjvMW = require('../middlewares/validateAjvMW');
const doctorCreateSchema = require('../utils/staffDoctorCreateValidate');
const doctorUpdateSchema = require('../utils/staffDoctorUpdateValidate');
const nursingServiceSchema = require('../utils/staffNursingServiceValidate');
const staffAccountSchema = require('../utils/staffAccountCreateValidate'); // ملف الـ Validation الجديد لحسابات الاستاف/الأدمن
const staffController = require('../controllers/staffController');

const router = express.Router();

// مسار المتابعة الشامل للحجوزات (يدعم الفلترة بالحالة، الطبيب، والتاريخ)
router.get('/bookings', authMW, checkRoleMW('STAFF', 'ADMIN'), staffController.listAllBookings);

// إلغاء الحجز بالطريقة العادية
router.patch('/bookings/:id/cancel', authMW, checkRoleMW('STAFF', 'ADMIN'), staffController.cancelBookingHandler);

// إلغاء الحجز برقم الحجز التسلسلي للدعم الفني
router.patch('/bookings/cancel-by-number/:bookingNumber', authMW, checkRoleMW('STAFF', 'ADMIN'), staffController.cancelBookingByNumberHandler);

// عرض تفاصيل حجز واحد بالكامل
router.get('/bookings/:id', authMW, checkRoleMW('STAFF', 'ADMIN'), staffController.getBookingDetails);

// تعديل بيانات حجز يدوياً بواسطة الأدمن
router.patch('/bookings/:id/edit', authMW, checkRoleMW('STAFF', 'ADMIN'), staffController.updateBookingByAdmin);

// مسارات الحسابات والتسوية الأسبوعية
router.get('/settlements', authMW, checkRoleMW('STAFF', 'ADMIN'), staffController.getCompletedBookingsForSettlement);
router.patch('/settlements/pay', authMW, checkRoleMW('STAFF', 'ADMIN'), staffController.settleBookings);

// الملخص المالي لمزود الخدمة
router.get('/providers/:id/financial-summary', authMW, checkRoleMW('STAFF', 'ADMIN'), staffController.getProviderFinancialSummary);

router.get('/providers/availability', authMW, checkRoleMW('STAFF', 'ADMIN'), staffController.providerAvailability);
router.get('/doctors/status', authMW, checkRoleMW('STAFF', 'ADMIN'), staffController.doctorsStatus);
router.get('/analytics', authMW, checkRoleMW('STAFF','ADMIN'), staffController.analytics);
router.patch('/providers/:type/:id/toggle-status', authMW, checkRoleMW('ADMIN'), staffController.toggleProviderStatus);

// مسارات إنشاء وتعديل الأطباء والممرضين والخدمات
router.post('/doctors', authMW, checkRoleMW('STAFF', 'ADMIN'), validateAjvMW(doctorCreateSchema), staffController.createDoctor);
router.patch('/doctors/:id', authMW, checkRoleMW('STAFF', 'ADMIN'), validateAjvMW(doctorUpdateSchema), staffController.updateDoctor);
router.get('/nursing-services', authMW, checkRoleMW('STAFF', 'ADMIN'), staffController.listNursingServices);
router.post('/nursing-services', authMW, checkRoleMW('STAFF', 'ADMIN'), validateAjvMW(nursingServiceSchema), staffController.createNursingService);
router.patch('/nursing-services/:id', authMW, checkRoleMW('STAFF', 'ADMIN'), validateAjvMW(nursingServiceSchema), staffController.updateNursingService);
router.get('/audit-logs', authMW, checkRoleMW('STAFF', 'ADMIN'), staffController.listAuditLogsHandler);
router.post('/nurses', authMW, checkRoleMW('STAFF', 'ADMIN'), validateAjvMW(require('../utils/staffNurseCreateValidate')), staffController.createNurse);

// مسار إنشاء حساب Staff أو Admin جديد
router.post('/accounts', authMW, checkRoleMW('STAFF', 'ADMIN'), validateAjvMW(staffAccountSchema), staffController.createStaffOrAdmin);

module.exports = router;
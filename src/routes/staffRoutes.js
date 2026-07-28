const express = require('express');
const authMW = require('../middlewares/authMW');
const checkRoleMW = require('../middlewares/checkRoleMW');
const validateAjvMW = require('../middlewares/validateAjvMW');
const doctorCreateSchema = require('../utils/staffDoctorCreateValidate');
const doctorUpdateSchema = require('../utils/staffDoctorUpdateValidate');
const nursingServiceSchema = require('../utils/staffNursingServiceValidate');
const staffController = require('../controllers/staffController');

const router = express.Router();

router.get('/bookings/pending', authMW, checkRoleMW('STAFF', 'ADMIN'), staffController.pendingBookings);
router.patch('/bookings/:id/confirm', authMW, checkRoleMW('STAFF', 'ADMIN'), staffController.confirmBooking);
router.patch('/bookings/:id/cancel', authMW, checkRoleMW('STAFF', 'ADMIN'), staffController.cancelBookingHandler);
router.get('/providers/availability', authMW, checkRoleMW('STAFF', 'ADMIN'), staffController.providerAvailability);
router.get('/doctors/status', authMW, checkRoleMW('STAFF', 'ADMIN'), staffController.doctorsStatus);
router.get('/analytics', authMW, checkRoleMW('ADMIN'), staffController.analytics);
router.patch('/providers/:type/:id/toggle-status', authMW, checkRoleMW('ADMIN'), staffController.toggleProviderStatus);
router.post('/doctors', authMW, checkRoleMW('STAFF', 'ADMIN'), validateAjvMW(doctorCreateSchema), staffController.createDoctor);
router.patch('/doctors/:id', authMW, checkRoleMW('STAFF', 'ADMIN'), validateAjvMW(doctorUpdateSchema), staffController.updateDoctor);
router.get('/nursing-services', authMW, checkRoleMW('STAFF', 'ADMIN'), staffController.listNursingServices);
router.post('/nursing-services', authMW, checkRoleMW('STAFF', 'ADMIN'), validateAjvMW(nursingServiceSchema), staffController.createNursingService);
router.patch('/nursing-services/:id', authMW, checkRoleMW('STAFF', 'ADMIN'), validateAjvMW(nursingServiceSchema), staffController.updateNursingService);
router.get('/audit-logs', authMW, checkRoleMW('STAFF', 'ADMIN'), staffController.listAuditLogsHandler);
router.post('/nurses', authMW, checkRoleMW('STAFF', 'ADMIN'), validateAjvMW(require('../utils/staffNurseCreateValidate')), staffController.createNurse);

module.exports = router;
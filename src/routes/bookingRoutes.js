const express = require('express');
const authMW = require('../middlewares/authMW');
const validateAjvMW = require('../middlewares/validateAjvMW');
const bookingCreateSchema = require('../utils/BookingCreateValidate');
const bookingController = require('../controllers/bookingController');

const router = express.Router();

// تأكد من طباعة Controller للتأكد أنه ليس undefined
// console.log("Booking Controller:", bookingController); 

router.post('/doctor', authMW, validateAjvMW(bookingCreateSchema), bookingController.createDoctorBookingHandler);
router.post('/nursing', authMW, validateAjvMW(require('../utils/nursingBookingValidate')), bookingController.createNursingBookingHandler);
router.get('/my-bookings', authMW, bookingController.myBookings);

module.exports = router;
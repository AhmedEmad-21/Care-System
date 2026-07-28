const express = require('express');
const filterAvailableDoctorsMW = require('../middlewares/filterAvailableDoctorsMW');
const doctorController = require('../controllers/doctorController');
const authMW = require('../middlewares/authMW');
const router = express.Router();


router.get('/available', doctorController.listDoctors);
router.get('/', filterAvailableDoctorsMW, doctorController.listDoctors);
router.get('/search', authMW, doctorController.listAvailableDoctors);
router.get('/:id', doctorController.getDoctorById);

module.exports = router;
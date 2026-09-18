const express = require('express');
const filterAvailableDoctorsMW = require('../middlewares/filterAvailableDoctorsMW');
const doctorController = require('../controllers/doctorController');
const authMW = require('../middlewares/authMW');
const router = express.Router();

router.get('/specializations', doctorController.getSpecializations);
router.get('/available', doctorController.listDoctors);

router.get('/search-by-name', doctorController.searchDoctorsByName);
router.get('/filter', doctorController.filterDoctors);

router.get('/search', authMW, doctorController.listAvailableDoctors);
router.get('/', filterAvailableDoctorsMW, doctorController.listDoctors);

// تحديث وصف الطبيب
router.patch('/description', authMW, doctorController.updateMyDoctorDescription);
router.patch('/:id/description', authMW, doctorController.updateDoctorDescriptionById);

router.get('/:id', doctorController.getDoctorById);

module.exports = router;
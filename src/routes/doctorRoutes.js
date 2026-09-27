const express = require('express');
const filterAvailableDoctorsMW = require('../middlewares/filterAvailableDoctorsMW');
const doctorController = require('../controllers/doctorController');
const authMW = require('../middlewares/authMW');
const checkRoleMW = require('../middlewares/checkRoleMW');
const validateAjvMW = require('../middlewares/validateAjvMW');
const doctorUpdateSchema = require('../utils/staffDoctorUpdateValidate');

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

// جلب وتحديث الملف الشخصي وبيانات الطبيب بالكامل (متاح للطبيب نفسه وللاستاف وللأدمن)
router.get('/profile', authMW, checkRoleMW('Doctor', 'Staff', 'Admin'), doctorController.getDoctorProfile);
router.patch('/profile', authMW, checkRoleMW('Doctor', 'Staff', 'Admin'), validateAjvMW(doctorUpdateSchema), doctorController.updateDoctorProfile);
router.patch('/:id', authMW, checkRoleMW('Doctor', 'Staff', 'Admin'), validateAjvMW(doctorUpdateSchema), doctorController.updateDoctorProfile);

router.get('/:id', doctorController.getDoctorById);

module.exports = router;
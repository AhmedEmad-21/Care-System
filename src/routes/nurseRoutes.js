const express = require('express');
const filterAvailableDoctorsMW = require('../middlewares/filterAvailableDoctorsMW');
const authMW = require('../middlewares/authMW');
const checkRoleMW = require('../middlewares/checkRoleMW');
const validateAjvMW = require('../middlewares/validateAjvMW');
const nurseUpdateSchema = require('../utils/staffNurseUpdateValidate');
const nurseController = require('../controllers/nurseController');

const router = express.Router();

router.get('/available', nurseController.listNurses);
router.get('/search-by-name', nurseController.searchNursesByName);
router.get('/filter', nurseController.filterNurses);

router.get('/', filterAvailableDoctorsMW, nurseController.listNurses);
router.get('/nearby', authMW, nurseController.listNursesByService);

// تحديث وصف الممرض
router.patch('/description', authMW, nurseController.updateMyNurseDescription);
router.patch('/:id/description', authMW, nurseController.updateNurseDescriptionById);

// جلب وتحديث الملف الشخصي وبيانات الممرض بالكامل (متاح للممرض نفسه وللاستاف وللأدمن)
router.get('/profile', authMW, checkRoleMW('Nurse', 'Staff', 'Admin'), nurseController.getNurseProfile);
router.patch('/profile', authMW, checkRoleMW('Nurse', 'Staff', 'Admin'), validateAjvMW(nurseUpdateSchema), nurseController.updateNurseProfile);
router.patch('/:id', authMW, checkRoleMW('Nurse', 'Staff', 'Admin'), validateAjvMW(nurseUpdateSchema), nurseController.updateNurseProfile);

router.get('/:id', nurseController.getNurseById);

module.exports = router;
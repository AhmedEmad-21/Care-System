const express = require('express');
const filterAvailableDoctorsMW = require('../middlewares/filterAvailableDoctorsMW');
const authMW = require('../middlewares/authMW');
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

router.get('/:id', nurseController.getNurseById);

module.exports = router;
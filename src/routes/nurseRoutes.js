const express = require('express');
const filterAvailableDoctorsMW = require('../middlewares/filterAvailableDoctorsMW');
const authMW = require('../middlewares/authMW');
const nurseController = require('../controllers/nurseController');

const router = express.Router();

router.get('/available', nurseController.listNurses);
router.get('/search-by-name', nurseController.searchNursesByName);
router.get('/', filterAvailableDoctorsMW, nurseController.listNurses);
router.get('/nearby', authMW, nurseController.listNursesByService);

router.get('/:id', nurseController.getNurseById);

module.exports = router;

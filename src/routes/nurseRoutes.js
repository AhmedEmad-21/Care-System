const express = require('express');
const filterAvailableDoctorsMW = require('../middlewares/filterAvailableDoctorsMW');
const nurseController = require('../controllers/nurseController');

const router = express.Router();

router.get('/available', nurseController.listNurses);
router.get('/', filterAvailableDoctorsMW, nurseController.listNurses);
router.get('/nearby', nurseController.listNursesByService);

router.get('/:id', nurseController.getNurseById);

module.exports = router;

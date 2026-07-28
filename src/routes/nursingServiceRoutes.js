const express = require('express');
const authMW = require('../middlewares/authMW');
const validateAjvMW = require('../middlewares/validateAjvMW');
const nursingBookingSchema = require('../utils/nursingBookingValidate');
const nursingServiceController = require('../controllers/nursingServiceController');

const router = express.Router();

router.get('/', nursingServiceController.list);
router.get('/:id', nursingServiceController.detail);

module.exports = router;

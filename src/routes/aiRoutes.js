const express = require('express');
const authMW = require('../middlewares/authMW');
const validateAjvMW = require('../middlewares/validateAjvMW');
const aiSessionSchema = require('../utils/aisessionValidate');
const aiDoctorSearchSchema = require('../utils/aiDoctorSearchValidate');
const aiController = require('../controllers/aiController');

const router = express.Router();

router.post('/analyze-symptoms', authMW, validateAjvMW(aiSessionSchema), aiController.analyzeSymptoms);
router.post('/search-doctors', authMW, validateAjvMW(aiDoctorSearchSchema), aiController.searchDoctors);
router.get('/alternatives', authMW, aiController.getAlternatives);
module.exports = router;
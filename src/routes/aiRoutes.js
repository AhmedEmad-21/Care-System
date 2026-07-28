const express = require('express');
const authMW = require('../middlewares/authMW');
const validateAjvMW = require('../middlewares/validateAjvMW');
const aiSessionSchema = require('../utils/aisessionValidate');
const aiController = require('../controllers/aiController');

const router = express.Router();

router.post('/analyze', authMW, validateAjvMW(aiSessionSchema), aiController.analyzeSymptoms);
router.post('/match', authMW, validateAjvMW(aiSessionSchema), aiController.analyzeSymptoms);
router.post('/suggest', authMW, validateAjvMW(aiSessionSchema), aiController.suggest);
// أضف هذا السطر في ملف مسارات الـ AI الخاصة بك
router.get('/alternatives', authMW, aiController.getAlternatives);
module.exports = router;
const express = require('express');
const authMW = require('../middlewares/authMW');
const validateAjvMW = require('../middlewares/validateAjvMW');
const reviewSchema = require('../utils/reviewValidate');
const reviewController = require('../controllers/reviewController');

const router = express.Router();

router.post('/', authMW, validateAjvMW(reviewSchema), reviewController.postReview);
router.get('/:providerId', reviewController.listProviderReviews);

module.exports = router;
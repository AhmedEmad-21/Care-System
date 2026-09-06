const asyncHandler = require('../utils/asyncHandler');
const reviewService = require('../services/reviewService');

const postReview = asyncHandler(async (req, res) => {
  const reviewerId = req.user.id || req.user._id;
  const result = await reviewService.addReview({
    reviewerId,
    providerId: req.body.providerId,
    providerType: req.body.providerType,
    rating: req.body.rating,
    comment: req.body.comment,
  });

  return res.status(201).json({
    success: true,
    message: 'Review saved successfully',
    data: result,
  });
});

const listProviderReviews = asyncHandler(async (req, res) => {
  const reviews = await reviewService.getProviderReviews({
    providerId: req.params.providerId,
    providerType: req.query.providerType,
    limit: req.query.limit,
  });

  return res.json({
    success: true,
    data: reviews,
  });
});

module.exports = {
  postReview,
  listProviderReviews,
};
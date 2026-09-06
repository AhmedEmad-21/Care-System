const mongoose = require('mongoose');
const Review = require('../models/reviewModel');
const Booking = require('../models/bookingModel');
const NursingBooking = require('../models/nursingBookingModel');
const Doctor = require('../models/doctorModel');
const Nurse = require('../models/nurseModel');
const { BadRequestError, NotFoundError } = require('../errors/appErrors');

const normalizeProviderType = (providerType) => {
  const normalized = String(providerType || '').trim().toLowerCase();

  if (normalized === 'doctor') return 'Doctor';
  if (normalized === 'nurse') return 'Nurse';

  throw new BadRequestError('providerType must be Doctor or Nurse');
};

const getProviderModel = (providerType) => {
  if (providerType === 'Doctor') return Doctor;
  if (providerType === 'Nurse') return Nurse;

  throw new BadRequestError('providerType must be Doctor or Nurse');
};

const getBookingModel = (providerType) => {
  if (providerType === 'Doctor') return { model: Booking, bookingModel: 'Booking', providerField: 'doctorId' };
  if (providerType === 'Nurse') return { model: NursingBooking, bookingModel: 'NursingBooking', providerField: 'nurseId' };

  throw new BadRequestError('providerType must be Doctor or Nurse');
};

const assertValidObjectId = (value, fieldName) => {
  if (!mongoose.isValidObjectId(value)) {
    throw new BadRequestError(`${fieldName} must be a valid id`);
  }
};

const updateProviderReviewStats = async ({ providerType, providerId }) => {
  assertValidObjectId(providerId, 'providerId');
  const objectId = new mongoose.Types.ObjectId(providerId);
  const [summary] = await Review.aggregate([
    {
      $match: {
        providerModel: providerType,
        providerId: objectId,
      },
    },
    {
      $group: {
        _id: null,
        averageRating: { $avg: '$rating' },
        totalReviews: { $sum: 1 },
      },
    },
  ]);

  const rating = summary ? Number(summary.averageRating.toFixed(2)) : 0;
  const totalReviews = summary ? summary.totalReviews : 0;
  const ProviderModel = getProviderModel(providerType);

  await ProviderModel.findByIdAndUpdate(providerId, {
    rating,
    totalReviews,
  });

  return { rating, totalReviews };
};

const addReview = async ({ reviewerId, providerId, providerType, rating, comment = null }) => {
  const normalizedProviderType = normalizeProviderType(providerType);
  const numericRating = Number(rating);

  assertValidObjectId(providerId, 'providerId');
  assertValidObjectId(reviewerId, 'patientId');

  if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
    throw new BadRequestError('rating must be an integer between 1 and 5');
  }

  const { model: BookingModel, bookingModel, providerField } = getBookingModel(normalizedProviderType);
  const ProviderModel = getProviderModel(normalizedProviderType);
  const provider = await ProviderModel.findById(providerId).lean();

  if (!provider) {
    throw new NotFoundError('Provider not found');
  }

  const completedBooking = await BookingModel.findOne({
    patientId: reviewerId,
    [providerField]: providerId,
    status: 'completed',
  })
    .sort({ updatedAt: -1, createdAt: -1 })
    .lean();

  if (!completedBooking) {
    throw new BadRequestError('عفواً، لا يمكنك كتابة تقييم إلا بعد إتمام زيارة مكتملة ومؤكدة عبر التطبيق');
  }

  const review = await Review.findOneAndUpdate(
    { patientId: reviewerId, providerId },
    {
      patientId: reviewerId,
      providerId,
      providerModel: normalizedProviderType,
      bookingId: completedBooking._id,
      bookingModel,
      rating: numericRating,
      comment: comment ? String(comment).trim() : null,
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  const stats = await updateProviderReviewStats({
    providerType: normalizedProviderType,
    providerId,
  });

  return {
    review,
    provider: {
      id: providerId,
      providerModel: normalizedProviderType,
      ...stats,
    },
  };
};

const getProviderReviews = async ({ providerId, providerType = null, limit = 100 }) => {
  assertValidObjectId(providerId, 'providerId');
  const filter = { providerId };

  if (providerType) {
    filter.providerModel = normalizeProviderType(providerType);
  }

  return Review.find(filter)
    .sort({ createdAt: -1 })
    .limit(Math.min(Number(limit) || 100, 500))
    .populate('patientId', 'name profileImage')
    .lean();
};

module.exports = {
  addReview,
  getProviderReviews,
};
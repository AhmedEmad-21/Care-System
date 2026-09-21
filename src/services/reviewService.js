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

const addReview = async ({ reviewerId, providerId, providerType, rating, comment = null, bookingId = null }) => {
  const normalizedProviderType = normalizeProviderType(providerType);
  const numericRating = Number(rating);

  assertValidObjectId(providerId, 'providerId');
  assertValidObjectId(reviewerId, 'patientId');

  if (bookingId) {
    assertValidObjectId(bookingId, 'bookingId');
  }

  if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
    throw new BadRequestError('rating must be an integer between 1 and 5');
  }

  const { model: BookingModel, bookingModel, providerField } = getBookingModel(normalizedProviderType);
  const ProviderModel = getProviderModel(normalizedProviderType);
  const provider = await ProviderModel.findById(providerId).lean();

  if (!provider) {
    throw new NotFoundError('Provider not found');
  }

  let completedBooking;

  if (bookingId) {
    // لو تم إرسال الـ bookingId (من الإشعار مثلاً)، نتحقق منه مباشرة
    completedBooking = await BookingModel.findOne({
      _id: bookingId,
      patientId: reviewerId,
      [providerField]: providerId,
      status: 'completed',
    }).lean();

    if (!completedBooking) {
      throw new BadRequestError('الحجز المحدد غير موجود، أو لم تتم إصداره كحجز مكتمل لهذا المزود');
    }

    // التحقق عما إذا كان تم تقييم هذا الحجز بالذات مسبقاً (جعل الـ endpoint idempotent لنفس المستخدم)
    const existingReviewForBooking = await Review.findOne({ bookingId: completedBooking._id }).lean();
    if (existingReviewForBooking) {
      if (existingReviewForBooking.patientId.toString() === reviewerId.toString()) {
        if (!completedBooking.isReviewed) {
          await BookingModel.findByIdAndUpdate(completedBooking._id, { isReviewed: true });
        }
        return {
          isExisting: true,
          review: existingReviewForBooking,
          provider: {
            id: providerId,
            providerModel: normalizedProviderType,
            rating: provider.rating || 0,
            totalReviews: provider.totalReviews || 0,
          },
        };
      }
      throw new BadRequestError('لقد قمت بالفعل بتقييم هذا الحجز مسبقاً');
    }

    if (completedBooking.isReviewed) {
      throw new BadRequestError('لقد قمت بالفعل بتقييم هذا الحجز مسبقاً');
    }
  } else {
    // لو لم يتم إرسال bookingId، نبحث عن أحدث حجز مكتمل لهذا المزود ولم يتم تقييمه بعد
    const alreadyReviewedBookingIds = await Review.find({
      patientId: reviewerId,
      providerId,
    }).distinct('bookingId');

    completedBooking = await BookingModel.findOne({
      patientId: reviewerId,
      [providerField]: providerId,
      status: 'completed',
      isReviewed: false,
      _id: { $nin: alreadyReviewedBookingIds },
    })
      .sort({ updatedAt: -1, createdAt: -1 })
      .lean();

    if (!completedBooking) {
      throw new BadRequestError('عفواً، لا يوجد لديك زيارات مكتملة جديدة مع هذا المزود لم تقم بتقييمها بعد');
    }
  }

  try {
    // إنشاء تقييم جديد مستقل لكل حجز مكتمل
    const review = await Review.create({
      patientId: reviewerId,
      providerId,
      providerModel: normalizedProviderType,
      bookingId: completedBooking._id,
      bookingModel,
      rating: numericRating,
      comment: comment ? String(comment).trim() : null,
    });

    // تحديث حالة الحجز إلى مقيَّم (isReviewed: true)
    await BookingModel.findByIdAndUpdate(completedBooking._id, { isReviewed: true });

    const stats = await updateProviderReviewStats({
      providerType: normalizedProviderType,
      providerId,
    });

    return {
      isExisting: false,
      review,
      provider: {
        id: providerId,
        providerModel: normalizedProviderType,
        ...stats,
      },
    };
  } catch (err) {
    if (err.code === 11000) {
      if (completedBooking) {
        const existingReview = await Review.findOne({ bookingId: completedBooking._id }).lean();
        if (existingReview && existingReview.patientId.toString() === reviewerId.toString()) {
          return {
            isExisting: true,
            review: existingReview,
            provider: {
              id: providerId,
              providerModel: normalizedProviderType,
              rating: provider.rating || 0,
              totalReviews: provider.totalReviews || 0,
            },
          };
        }
      }
      throw new BadRequestError('لقد قمت بالفعل بتقييم هذا الحجز مسبقاً');
    }
    throw err;
  }
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
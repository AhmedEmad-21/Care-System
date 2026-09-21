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

  const reviewerIdStr = String(reviewerId);
  const providerIdStr = String(providerId);

  if (bookingId) {
    assertValidObjectId(bookingId, 'bookingId');
  }

  if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
    throw new BadRequestError('rating must be an integer between 1 and 5');
  }

  const { model: BookingModel, bookingModel, providerField } = getBookingModel(normalizedProviderType);
  const ProviderModel = getProviderModel(normalizedProviderType);
  const provider = await ProviderModel.findById(providerIdStr).lean();

  if (!provider) {
    throw new NotFoundError('Provider not found');
  }

  let completedBooking;

  if (bookingId) {
    const bookingIdStr = String(bookingId);
    completedBooking = await BookingModel.findById(bookingIdStr).lean();

    if (!completedBooking) {
      throw new NotFoundError('الحجز المحدد غير موجود');
    }

    if (completedBooking.patientId && completedBooking.patientId.toString() !== reviewerIdStr) {
      throw new BadRequestError('هذا الحجز لا يخص المستخدم الحالي');
    }

    if (completedBooking[providerField] && completedBooking[providerField].toString() !== providerIdStr) {
      throw new BadRequestError('هذا الحجز لا يخص هذا المزود المحدد');
    }

    if (completedBooking.status !== 'completed') {
      throw new BadRequestError('لا يمكن تقييم الحجز إلا بعد اكتماله');
    }

    // 1. التحقق أولاً عما إذا كان تم تقييم هذا الحجز بالذات مسبقاً (قبل فحص booking.isReviewed)
    const existingReviewForBooking = await Review.findOne({ bookingId: completedBooking._id }).lean();
    if (existingReviewForBooking) {
      if (existingReviewForBooking.patientId && existingReviewForBooking.patientId.toString() === reviewerIdStr) {
        if (!completedBooking.isReviewed) {
          await BookingModel.findByIdAndUpdate(completedBooking._id, { isReviewed: true });
        }
        return {
          isExisting: true,
          review: existingReviewForBooking,
          provider: {
            id: providerIdStr,
            providerModel: normalizedProviderType,
            rating: provider.rating || 0,
            totalReviews: provider.totalReviews || 0,
          },
        };
      }
      throw new BadRequestError('لقد تم تقييم هذا الحجز بالفعل ولا يمكن تقييمه أكثر من مرة');
    }

    // 2. إذا كان الحجز معلماً كـ isReviewed: true ولكن لم يتم العثور على existingReviewForBooking
    if (completedBooking.isReviewed) {
      const fallbackReview = await Review.findOne({
        patientId: reviewerIdStr,
        providerId: providerIdStr,
        bookingId: completedBooking._id,
      }).lean();

      if (fallbackReview) {
        return {
          isExisting: true,
          review: fallbackReview,
          provider: {
            id: providerIdStr,
            providerModel: normalizedProviderType,
            rating: provider.rating || 0,
            totalReviews: provider.totalReviews || 0,
          },
        };
      }
      throw new BadRequestError('لقد تم تقييم هذا الحجز بالفعل ولا يمكن تقييمه أكثر من مرة');
    }
  } else {
    // لو لم يتم إرسال bookingId، نبحث عن كل الحجوزات المكتملة لهذا المريض مع هذا المزود
    const completedBookings = await BookingModel.find({
      patientId: reviewerIdStr,
      [providerField]: providerIdStr,
      status: 'completed',
    })
      .sort({ updatedAt: -1, createdAt: -1 })
      .lean();

    if (!completedBookings || completedBookings.length === 0) {
      throw new BadRequestError('عفواً، لا يوجد لديك أي زيارات مكتملة مع هذا المزود');
    }

    const reviewedBookingIds = await Review.find({
      patientId: reviewerIdStr,
      providerId: providerIdStr,
    }).distinct('bookingId');
    const reviewedIdSet = new Set(reviewedBookingIds.map((id) => (id ? id.toString() : '')));

    // البحث عن حجز مكتمل لم يتم تقييمه بعد
    completedBooking = completedBookings.find(
      (b) => !b.isReviewed && !reviewedIdSet.has(b._id.toString())
    );

    if (!completedBooking) {
      // إذا كانت جميع الحجوزات المكتملة تم تقييمها بالفعل، نرجع آخر تقييم سابق ليكون الطلب idempotent
      const latestReview = await Review.findOne({
        patientId: reviewerIdStr,
        providerId: providerIdStr,
      })
        .sort({ createdAt: -1 })
        .lean();

      if (latestReview) {
        return {
          isExisting: true,
          review: latestReview,
          provider: {
            id: providerIdStr,
            providerModel: normalizedProviderType,
            rating: provider.rating || 0,
            totalReviews: provider.totalReviews || 0,
          },
        };
      }

      throw new BadRequestError('عفواً، لا يوجد لديك زيارات مكتملة جديدة مع هذا المزود لم تقم بتقييمها بعد');
    }
  }

  try {
    // إنشاء تقييم جديد مستقل لكل حجز مكتمل
    const review = await Review.create({
      patientId: reviewerIdStr,
      providerId: providerIdStr,
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
      providerId: providerIdStr,
    });

    return {
      isExisting: false,
      review,
      provider: {
        id: providerIdStr,
        providerModel: normalizedProviderType,
        ...stats,
      },
    };
  } catch (err) {
    if (err.code === 11000) {
      if (completedBooking) {
        const existingReview = await Review.findOne({ bookingId: completedBooking._id }).lean();
        if (existingReview && existingReview.patientId && existingReview.patientId.toString() === reviewerIdStr) {
          if (!completedBooking.isReviewed) {
            await BookingModel.findByIdAndUpdate(completedBooking._id, { isReviewed: true });
          }
          return {
            isExisting: true,
            review: existingReview,
            provider: {
              id: providerIdStr,
              providerModel: normalizedProviderType,
              rating: provider.rating || 0,
              totalReviews: provider.totalReviews || 0,
            },
          };
        }
      }
      throw new BadRequestError('لقد تم تقييم هذا الحجز بالفعل ولا يمكن تقييمه أكثر من مرة');
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
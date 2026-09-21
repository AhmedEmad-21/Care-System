const mongoose = require('mongoose');
const asyncHandler = require('../utils/asyncHandler');
const Booking = require('../models/bookingModel');
const NursingBooking = require('../models/nursingBookingModel');
const Doctor = require('../models/doctorModel');
const Review = require('../models/reviewModel');
const { createDoctorBooking, createNursingBooking } = require('../services/bookingService');

const DOCTOR_POPULATE_FIELDS = 'name specialization description basePrice urgentPrice profileImage rating totalReviews address phoneNumber workingHours offDays location';
const NURSE_POPULATE_FIELDS = 'name description phoneNumber profileImage rating totalReviews address';

const formatDoctorObj = (doc) => {
  if (!doc) return doc;
  return {
    _id: doc._id,
    name: doc.name,
    specialization: doc.specialization,
    description: doc.description || '',
    basePrice: doc.basePrice != null ? Number(doc.basePrice) : 0,
    urgentPrice: (doc.urgentPrice != null && Number(doc.urgentPrice) > 0)
      ? Number(doc.urgentPrice)
      : Number(doc.basePrice || 0),
    profileImage: doc.profileImage || null,
    rating: doc.rating || 0,
    totalReviews: doc.totalReviews || 0,
    address: doc.address,
    phoneNumber: doc.phoneNumber,
    workingHours: doc.workingHours,
    offDays: doc.offDays,
    location: doc.location
  };
};

const createDoctorBookingHandler = asyncHandler(async (req, res) => {
  const patientId = req.user.id || req.user._id;

  const booking = await createDoctorBooking({
    ...req.body,
    patientId: patientId
  });

  // إرجاع كائن الحجز مع عمل populate فوري وكامل لبيانات الطبيب
  const populatedBooking = await Booking.findById(booking._id)
    .populate('doctorId', DOCTOR_POPULATE_FIELDS)
    .lean();

  return res.status(201).json({ success: true, data: populatedBooking || booking });
});

const createNursingBookingHandler = asyncHandler(async (req, res) => {
  const patientId = req.user.id || req.user._id;
  
  const booking = await createNursingBooking({
    ...req.body,
    patientId
  });

  const populatedBooking = await NursingBooking.findById(booking._id)
    .populate('nurseId', NURSE_POPULATE_FIELDS)
    .populate('serviceId', 'name description basePrice')
    .lean();

  return res.status(201).json({ success: true, data: populatedBooking || booking });
});

const myBookings = asyncHandler(async (req, res) => {
  const patientId = req.user.id || req.user._id;
  
  const [rawDoctorBookings, rawNursingBookings] = await Promise.all([
    Booking.find({ patientId })
      .populate('doctorId', DOCTOR_POPULATE_FIELDS)
      .populate('nurseId', NURSE_POPULATE_FIELDS)
      .sort({ createdAt: -1 })
      .lean(),
      
    NursingBooking.find({ patientId })
      .populate('nurseId', NURSE_POPULATE_FIELDS)
      .populate('serviceId', 'name description basePrice')
      .sort({ createdAt: -1 })
      .lean()
  ]);

  // التحقق الحصين: التأكد من عمل populate لأي حجز لم يقم Mongoose بعمل populate له (مثلاً String ID أو userId)
  const unpopulatedDoctorIds = [];
  rawDoctorBookings.forEach((b) => {
    if (b.doctorId) {
      const isUnpopulated = typeof b.doctorId === 'string' ||
        b.doctorId instanceof mongoose.Types.ObjectId ||
        !b.doctorId.name;
      if (isUnpopulated) {
        unpopulatedDoctorIds.push(b.doctorId.toString());
      }
    }
  });

  if (unpopulatedDoctorIds.length > 0) {
    const fetchedDoctors = await Doctor.find({
      $or: [
        { _id: { $in: unpopulatedDoctorIds } },
        { userId: { $in: unpopulatedDoctorIds } }
      ]
    }).lean();

    const doctorMap = new Map();
    fetchedDoctors.forEach((doc) => {
      const formatted = formatDoctorObj(doc);
      doctorMap.set(doc._id.toString(), formatted);
      if (doc.userId) {
        doctorMap.set(doc.userId.toString(), formatted);
      }
    });

    rawDoctorBookings.forEach((b) => {
      if (b.doctorId) {
        const isUnpopulated = typeof b.doctorId === 'string' ||
          b.doctorId instanceof mongoose.Types.ObjectId ||
          !b.doctorId.name;
        if (isUnpopulated) {
          const idStr = b.doctorId.toString();
          if (doctorMap.has(idStr)) {
            b.doctorId = doctorMap.get(idStr);
          }
        }
      }
    });
  }

  // جلب كافة التقييمات المرتبطة بالحجوزات المسترجعة لربطها مباشرة
  const allBookingIds = [
    ...rawDoctorBookings.map((b) => b._id),
    ...rawNursingBookings.map((b) => b._id),
  ];

  const reviews = await Review.find({
    bookingId: { $in: allBookingIds },
  })
    .select('bookingId rating comment')
    .lean();

  const reviewMap = new Map();
  reviews.forEach((r) => {
    reviewMap.set(r.bookingId.toString(), {
      rating: r.rating,
      comment: r.comment || '',
    });
  });

  // فك أي تشابك مرجعي لضمان إرجاع كائنات نقية ومستقلة 100% بدون أي تكرار مرجعي
  const doctorBookings = rawDoctorBookings.map((b) => {
    const reviewData = reviewMap.get(b._id.toString()) || null;
    const isReviewed = Boolean(b.isReviewed) || Boolean(reviewData);

    return {
      ...b,
      isReviewed,
      review: isReviewed ? (reviewData || null) : null,
      doctorId: (b.doctorId && typeof b.doctorId === 'object') ? { ...b.doctorId } : b.doctorId,
      nurseId: (b.nurseId && typeof b.nurseId === 'object') ? { ...b.nurseId } : b.nurseId,
    };
  });

  const nursingBookings = rawNursingBookings.map((b) => {
    const reviewData = reviewMap.get(b._id.toString()) || null;
    const isReviewed = Boolean(b.isReviewed) || Boolean(reviewData);

    return {
      ...b,
      isReviewed,
      review: isReviewed ? (reviewData || null) : null,
      nurseId: (b.nurseId && typeof b.nurseId === 'object') ? { ...b.nurseId } : b.nurseId,
      serviceId: (b.serviceId && typeof b.serviceId === 'object') ? { ...b.serviceId } : b.serviceId,
    };
  });

  return res.json({ success: true, data: { doctorBookings, nursingBookings } });
});

const getBookingByIdHandler = asyncHandler(async (req, res) => {
  const patientId = req.user.id || req.user._id;
  const { id } = req.params;

  let booking = await Booking.findOne({ _id: id, patientId })
    .populate('doctorId', DOCTOR_POPULATE_FIELDS)
    .populate('nurseId', NURSE_POPULATE_FIELDS)
    .lean();

  let type = 'doctor';

  if (!booking) {
    booking = await NursingBooking.findOne({ _id: id, patientId })
      .populate('nurseId', NURSE_POPULATE_FIELDS)
      .populate('serviceId', 'name description basePrice')
      .lean();
    type = 'nursing';
  }

  if (!booking) {
    return res.status(404).json({ success: false, message: 'الحجز غير موجود أو لا تملك صلاحية للوصول إليه' });
  }

  // فحص احتياطي لـ doctorId
  if (booking.doctorId && (typeof booking.doctorId === 'string' || booking.doctorId instanceof mongoose.Types.ObjectId || !booking.doctorId.name)) {
    const doc = await Doctor.findOne({
      $or: [
        { _id: booking.doctorId },
        { userId: booking.doctorId }
      ]
    }).lean();
    if (doc) {
      booking.doctorId = formatDoctorObj(doc);
    }
  }

  let reviewData = null;
  const foundReview = await Review.findOne({ bookingId: booking._id })
    .select('rating comment')
    .lean();

  if (foundReview) {
    reviewData = {
      rating: foundReview.rating,
      comment: foundReview.comment || '',
    };
  }

  const isReviewed = Boolean(booking.isReviewed) || Boolean(reviewData);

  return res.json({ 
    success: true, 
    data: { 
      ...booking, 
      isReviewed,
      review: isReviewed ? reviewData : null,
      bookingType: booking.bookingType || type 
    } 
  });
});

module.exports = { 
  createDoctorBookingHandler, 
  createNursingBookingHandler, 
  myBookings,
  getBookingByIdHandler
};
const mongoose = require('mongoose');

const bookingStatuses = ['pending', 'confirmed', 'cancelled', 'completed', 'rejected'];

const geoPointSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator(value) {
          return Array.isArray(value) && value.length === 2;
        },
        message: 'coordinates must contain [longitude, latitude]',
      },
    },
  },
  { _id: false }
);

const bookingSchema = new mongoose.Schema(
  {
    // رقم حجز تسلسلي تصاعدي (1000, 1001, ...)
    bookingNumber: {
      type: Number,
      unique: true,
      sparse: true,
      index: true,
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      default: null,
    },
    nurseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Nurse',
      default: null,
    },
    bookingType: {
      type: String,
      enum: ['regular', 'urgent'],
      default: 'regular',
      index: true,
    },
    requestLocation: {
      type: geoPointSchema,
      default: null,
    },
    suggestedSpecialty: {
      type: String,
      default: null,
      trim: true,
    },
    appointmentTime: {
      type: Date,
      default: null,
    },
    totalCost: {
      type: Number,
      default: 0,
      min: 0,
    },
    // الحقول المالية والتسوية الأسبوعية
    isSettled: {
      type: Boolean,
      default: false,
      index: true,
    },
    settledAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: bookingStatuses,
      default: 'pending',
      index: true,
    },
    isReviewed: {
      type: Boolean,
      default: false,
      index: true,
    },
    staffNote: {
      type: String,
      default: null,
      trim: true,
    },
    confirmedByStaffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

// توليد رقم حجز تسلسلي تلقائياً قبل التحقق والحفظ (مشترك بين الأطباء والتمريض)
const { getNextSharedBookingNumber } = require('../utils/bookingNumberUtils');

bookingSchema.pre('validate', async function () {
  if (!this.bookingNumber) {
    this.bookingNumber = await getNextSharedBookingNumber();
  }
});

bookingSchema.index({ requestLocation: '2dsphere' });
bookingSchema.index({ patientId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('Booking', bookingSchema);
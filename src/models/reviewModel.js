const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    providerId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: 'providerModel',
      index: true,
    },
    providerModel: {
      type: String,
      required: true,
      enum: ['Doctor', 'Nurse'],
      index: true,
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: 'bookingModel',
      index: true,
    },
    bookingModel: {
      type: String,
      required: true,
      enum: ['Booking', 'NursingBooking'],
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      default: null,
      trim: true,
    },
  },
  { timestamps: true }
);

reviewSchema.index({ patientId: 1, providerId: 1 }, { unique: true });

module.exports = mongoose.model('Review', reviewSchema);
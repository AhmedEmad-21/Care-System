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

const nursingBookingSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    nurseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Nurse',
      required: true,
      index: true,
    },
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'NursingService',
      required: true,
    },
    requestLocation: {
      type: geoPointSchema,
      required: true,
    },
    appointmentTime: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: bookingStatuses,
      default: 'pending',
      index: true,
    },
    totalCost: {
      type: Number,
      default: 0,
      min: 0,
    },
    staffNote: {
      type: String,
      default: null,
      trim: true,
    },
  },
  { timestamps: true }
);

nursingBookingSchema.index({ requestLocation: '2dsphere' });

module.exports = mongoose.model('NursingBooking', nursingBookingSchema);
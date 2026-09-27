const mongoose = require('mongoose');

const geoPointSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true }
  },
  { _id: false }
);

const nurseSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    phoneNumber: { type: String, required: true, unique: true, index: true },
    address: { type: String, required: false, default: '', trim: true },
    experience: { type: String, required: false, default: '', trim: true },
    services: { type: [String], default: [] },
    location: { type: geoPointSchema, required: true },
    commissionRate: { type: Number, default: 10, min: 0 }, 
    profileImage: { type: String, required: false }, // [جديد] صورة البروفايل للممرض
    rating: { type: Number, default: 0, min: 0, max: 5 },
    totalReviews: { type: Number, default: 0, min: 0 },
    workingHours: {
      start: { type: String, default: '09:00' },
      end: { type: String, default: '17:00' }
    },
    isAvailable: { type: Boolean, default: true },
    offDays: { type: [Number], default: [] },
    description: { type: String, required: false, default: '', trim: true },
    unavailableDates: { type: [String], default: [] },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true }
);

nurseSchema.index({ location: '2dsphere' });
nurseSchema.index({ userId: 1 });

module.exports = mongoose.model('Nurse', nurseSchema);
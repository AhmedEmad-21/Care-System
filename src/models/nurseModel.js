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
    location: { type: geoPointSchema, required: true },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    totalReviews: { type: Number, default: 0, min: 0 },
    isAvailable: { type: Boolean, default: true },
    offDays: { type: [Number], default: [] }
  },
  { timestamps: true }
);

// فهرس الجغرافيا للبحث (مطلوب للـ $geoNear)
nurseSchema.index({ location: '2dsphere' });

// تم حذف السطر الخاص بالـ unique index على الـ coordinates للسماح بتكرار الموقع

module.exports = mongoose.model('Nurse', nurseSchema);
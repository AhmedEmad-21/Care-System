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
    isAvailable: { type: Boolean, default: true },
    offDays: { type: [Number], default: [] }
  },
  { timestamps: true }
);
// فهرس الجغرافيا للبحث
nurseSchema.index({ location: '2dsphere' });

// فهرس فريد لمنع وجود ممرضين في نفس الموقع الجغرافي
nurseSchema.index({ "location.coordinates": 1 }, { unique: true });

module.exports = mongoose.model('Nurse', nurseSchema);
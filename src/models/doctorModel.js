const mongoose = require('mongoose');

const geoPointSchema = new mongoose.Schema({
  type: { type: String, enum: ['Point'], default: 'Point' },
  coordinates: { type: [Number], required: true }
}, { _id: false });

const doctorSchema = new mongoose.Schema({
  name: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  phoneNumber: { type: String, required: true, unique: true, index: true },
  secondaryPhoneNumber: { type: String, required: false },
  address: { type: String, required: true },
  specialization: { type: String, required: true },
  location: { type: geoPointSchema, required: true },
  basePrice: { type: Number, required: true, min: 0 },
  profileImage: { type: String, required: false },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  workingHours: {
    start: { type: String, default: '09:00' },
    end: { type: String, default: '17:00' }
  },
  offDays: { type: [Number], default: [] },
  isAvailable: { type: Boolean, default: true }
}, { timestamps: true });

// فهرس الـ 2dsphere للبحث الجغرافي
doctorSchema.index({ location: '2dsphere' });

// فهرس فريد لمنع وجود طبيبين في نفس الإحداثيات بالضبط
doctorSchema.index({ "location.coordinates": 1 }, { unique: true });

module.exports = mongoose.model('Doctor', doctorSchema);
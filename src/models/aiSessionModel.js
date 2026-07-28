const mongoose = require('mongoose');

const aiSessionSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    symptoms: {
      type: String,
      required: true,
      trim: true,
    },
    suggestedSpecialty: {
      type: String,
      default: null,
      trim: true,
    },
    confidence: {
      type: Number,
      default: 0,
      min: 0,
      max: 1,
    },
    matchedDoctorIds: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'Doctor',
      default: [],
    },
    notes: {
      type: String,
      default: null,
      trim: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AISession', aiSessionSchema);
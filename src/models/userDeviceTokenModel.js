const mongoose = require('mongoose');

const userDeviceTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    fcmToken: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    deviceType: {
      type: String,
      required: true,
      enum: ['android', 'ios'],
      index: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('UserDeviceToken', userDeviceTokenSchema);
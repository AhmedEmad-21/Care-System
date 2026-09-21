const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const Review = require('../src/models/reviewModel');
  const Booking = require('../src/models/bookingModel');
  const NursingBooking = require('../src/models/nursingBookingModel');

  const reviews = await Review.find().lean();
  console.log('Found total reviews:', reviews.length);

  for (const rev of reviews) {
    if (rev.bookingId) {
      if (rev.bookingModel === 'Booking' || !rev.bookingModel) {
        const res = await Booking.findByIdAndUpdate(rev.bookingId, { isReviewed: true });
        if (res) console.log('Updated Doctor Booking:', rev.bookingId.toString(), 'isReviewed: true');
      }
      if (rev.bookingModel === 'NursingBooking' || !rev.bookingModel) {
        const res = await NursingBooking.findByIdAndUpdate(rev.bookingId, { isReviewed: true });
        if (res) console.log('Updated Nursing Booking:', rev.bookingId.toString(), 'isReviewed: true');
      }
    }
  }

  const dRes = await Booking.updateMany({ isReviewed: { $exists: false } }, { $set: { isReviewed: false } });
  console.log('Set default isReviewed: false on Doctor Bookings:', dRes.modifiedCount);

  const nRes = await NursingBooking.updateMany({ isReviewed: { $exists: false } }, { $set: { isReviewed: false } });
  console.log('Set default isReviewed: false on Nursing Bookings:', nRes.modifiedCount);

  await mongoose.disconnect();
  console.log('Done synchronization');
}

run().catch(console.error);

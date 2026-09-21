const mongoose = require('mongoose');

/**
 * توليد رقم حجز تسلسلي موحد ومشترك بين حجوزات الأطباء والتمريض
 * مثال: دكتور 1000 -> ممرض 1001 -> دكتور 1002 ...
 */
const getNextSharedBookingNumber = async () => {
  const [lastDoc, lastNurse] = await Promise.all([
    mongoose.model('Booking').findOne({ bookingNumber: { $exists: true, $ne: null } }).sort({ bookingNumber: -1 }).select('bookingNumber').lean(),
    mongoose.model('NursingBooking').findOne({ bookingNumber: { $exists: true, $ne: null } }).sort({ bookingNumber: -1 }).select('bookingNumber').lean(),
  ]);

  const maxDoc = (lastDoc && typeof lastDoc.bookingNumber === 'number') ? lastDoc.bookingNumber : 999;
  const maxNurse = (lastNurse && typeof lastNurse.bookingNumber === 'number') ? lastNurse.bookingNumber : 999;
  const maxNum = Math.max(maxDoc, maxNurse);

  return maxNum >= 1000 ? maxNum + 1 : 1000;
};

module.exports = {
  getNextSharedBookingNumber,
};

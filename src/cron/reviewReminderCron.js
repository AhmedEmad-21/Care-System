const Booking = require('../models/bookingModel');
const Review = require('../models/reviewModel');
const { sendNotificationToUser } = require('../services/notificationService');
const { BOOKING_STATUSES } = require('../config/constants');

const initReviewReminderCron = () => {
  // تشغيل الفحص مرة كل 24 ساعة (مثلاً) أو حسب الوقت المناسب
  const CHECK_INTERVAL = 24 * 60 * 60 * 1000; // كل 24 ساعة

  const runReminderTask = async () => {
    try {
      console.log('⏳ Running scheduled job: Checking for unreviewed completed bookings...');

      const twoWeeksAgoStart = new Date();
      twoWeeksAgoStart.setDate(twoWeeksAgoStart.getDate() - 15);

      const twoWeeksAgoEnd = new Date();
      twoWeeksAgoEnd.setDate(twoWeeksAgoEnd.getDate() - 14);

      const completedBookings = await Booking.find({
        status: BOOKING_STATUSES.COMPLETED,
        isReviewed: false,
        updatedAt: {
          $gte: twoWeeksAgoStart,
          $lte: twoWeeksAgoEnd,
        },
      }).lean();

      if (!completedBookings || completedBookings.length === 0) {
        return;
      }

      for (const booking of completedBookings) {
        const existingReview = await Review.findOne({ bookingId: booking._id }).lean();

        if (!existingReview) {
          const providerId = booking.doctorId || booking.nurseId;
          const providerLabel = booking.doctorId ? 'Doctor' : 'Nurse';

          if (booking.patientId && providerId) {
            await sendNotificationToUser({
              userId: booking.patientId,
              title: 'هل نسيت تقييم تجربتك؟ ⭐',
              body: `مرت أسبوعان على زيارتك الأخيرة. شاركنا رأيك لمساعدة الآخرين في اختيار أفضل أداء مع ${providerLabel}`,
              type: 'review_prompt',
              data: {
                bookingId: booking._id.toString(),
                providerId: providerId.toString(),
                providerType: providerLabel,
                action: 'open_review_screen',
              },
            });

            console.log(`Reminder notification sent for booking ID: ${booking._id}`);
          }
        }
      }
    } catch (error) {
      console.error('Error in review reminder cron job:', error);
    }
  };

  // تشغيل الفحص لأول مرة بعد دقيقة من تشغيل السيرفر، ثم تكراره كل 24 ساعة
  setTimeout(runReminderTask, 60 * 1000);
  setInterval(runReminderTask, CHECK_INTERVAL);

  console.log('📅 Review Reminder (Native setInterval) initialized successfully.');
};

module.exports = { initReviewReminderCron };
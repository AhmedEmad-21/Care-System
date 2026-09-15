const cron = require('node-cron');
const Booking = require('../models/bookingModel');
const Review = require('../models/reviewModel');
const { sendNotificationToUser } = require('../services/notificationService');
const { BOOKING_STATUSES } = require('../config/constants');

// جدولة المهمة لتنشط مرتين أسبوعياً أو يومياً للتأكد، ولتكن يومياً مثلاً الساعة 10 صباحاً للتحقق من المواعيد المستحقة
// (0 10 * * *) تعني يومياً الساعة 10 صباحاً، ويمكنك تعديلها حسب رغبتك
const initReviewReminderCron = () => {
  cron.schedule('0 10 * * *', async () => {
    try {
      console.log('⏳ Running scheduled job: Checking for unreviewed completed bookings...');

      // حساب الفترة الزمنية: الحجوزات التي اكتملت قبل أسبوعين (من 14 إلى 15 يوم مثلاً) ولم يتم إزعاجهم من قبل
      const twoWeeksAgoStart = new Date();
      twoWeeksAgoStart.setDate(twoWeeksAgoStart.getDate() - 15);

      const twoWeeksAgoEnd = new Date();
      twoWeeksAgoEnd.setDate(twoWeeksAgoEnd.getDate() - 14);

      // البحث عن الحجوزات المكتملة في هذا النطاق الزمني
      const completedBookings = await Booking.find({
        status: BOOKING_STATUSES.COMPLETED,
        updatedAt: {
          $gte: twoWeeksAgoStart,
          $lte: twoWeeksAgoEnd,
        },
      }).lean();

      if (!completedBookings || completedBookings.length === 0) {
        return;
      }

      for (const booking of completedBookings) {
        // التحقق مما إذا كان المريض قد قام بالفعل بعمل تقييم لهذا الحجز
        const existingReview = await Review.findOne({ bookingId: booking._id }).lean();

        if (!existingReview) {
          const providerId = booking.doctorId || booking.nurseId;
          const providerLabel = booking.doctorId ? 'Doctor' : 'Nurse';

          if (booking.patientId && providerId) {
            // إرسال إشعار تذكيري ودي
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
  });

  console.log('📅 Review Reminder Cron Job initialized successfully.');
};

module.exports = { initReviewReminderCron };
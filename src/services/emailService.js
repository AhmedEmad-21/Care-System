const nodemailer = require('nodemailer');
const config = require('../config/appConfig');
const { ServiceUnavailableError } = require('../errors/appErrors');

let transporter;

const getTransporter = () => {
  if (transporter) return transporter;

  const { service, user, appPassword } = config.emailConfig;
  if (!service || !user || !appPassword) {
    throw new ServiceUnavailableError('Email service is not configured');
  }

  transporter = nodemailer.createTransport({
    service,
    auth: {
      user,
      pass: appPassword,
    },
  });

  return transporter;
};

const buildOtpEmailHtml = ({ otp, expiryMinutes, userName }) => `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:24px 0;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:#0f766e;padding:24px;text-align:center;color:#ffffff;font-size:20px;font-weight:bold;">
              ${config.emailConfig.fromName}
            </td>
          </tr>
          <tr>
            <td style="padding:32px 28px;color:#1f2937;">
              <p style="margin:0 0 12px;font-size:16px;">مرحباً${userName ? ` ${userName}` : ''}،</p>
              <p style="margin:0 0 20px;font-size:15px;line-height:1.7;">
                لقد تلقينا طلباً لإعادة تعيين كلمة المرور الخاصة بحسابك. استخدم رمز التحقق التالي:
              </p>
              <div style="text-align:center;margin:28px 0;">
                <span style="display:inline-block;letter-spacing:8px;font-size:32px;font-weight:700;color:#0f766e;background:#ecfdf5;border:1px dashed #99f6e4;border-radius:10px;padding:16px 24px;">
                  ${otp}
                </span>
              </div>
              <p style="margin:0 0 12px;font-size:14px;line-height:1.7;color:#4b5563;">
                هذا الرمز صالح لمدة <strong>${expiryMinutes} دقيقة</strong> فقط. لا تشاركه مع أي شخص.
              </p>
              <p style="margin:0;font-size:13px;line-height:1.7;color:#6b7280;">
                إذا لم تطلب إعادة تعيين كلمة المرور، يمكنك تجاهل هذه الرسالة بأمان.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px;background:#f9fafb;text-align:center;font-size:12px;color:#9ca3af;">
              © ${new Date().getFullYear()} ${config.emailConfig.fromName}. جميع الحقوق محفوظة.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const sendPasswordResetOtp = async ({ to, otp, expiryMinutes, userName }) => {
  const mailer = getTransporter();
  const { user, fromName } = config.emailConfig;

  await mailer.sendMail({
    from: `"${fromName}" <${user}>`,
    to,
    subject: 'رمز التحقق لإعادة تعيين كلمة المرور',
    text: `رمز التحقق الخاص بك هو: ${otp}. الرمز صالح لمدة ${expiryMinutes} دقيقة. لا تشاركه مع أي شخص.`,
    html: buildOtpEmailHtml({ otp, expiryMinutes, userName }),
  });
};

module.exports = {
  sendPasswordResetOtp,
};

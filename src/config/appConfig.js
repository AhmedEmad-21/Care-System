const parseDuration = require('../utils/parseDuration');

const env = process.env.NODE_ENV || 'development';

const port = Number(process.env.PORT || 3000);
const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/care-system';
const jwtSecret = process.env.JWT_SECRET || 'care-system-development-secret';
const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || jwtSecret;

module.exports = {
  port,
  mongoUri,
  isProduction: env === 'production',
  isTest: env === 'test',
  appConfig: {
    trustProxy: String(process.env.TRUST_PROXY || '').toLowerCase() === 'true',
    timezone: process.env.APP_TIMEZONE || 'Africa/Cairo',
  },
  emailConfig: {
    service: process.env.EMAIL_SERVICE || 'gmail',
    user: process.env.EMAIL_USER || '',
    appPassword: process.env.EMAIL_APP_PASSWORD || '',
    fromName: process.env.EMAIL_FROM_NAME || 'Care System Support',
  },
  otpConfig: {
    length: Number(process.env.OTP_LENGTH || 6),
    expiresInMs: parseDuration(process.env.OTP_EXPIRES_IN, 5 * 60 * 1000),
    maxAttempts: Number(process.env.OTP_MAX_ATTEMPTS || 3),
    resendCooldownMs: parseDuration(process.env.OTP_RESEND_COOLDOWN, 60 * 1000),
    verifiedWindowMs: parseDuration(process.env.OTP_VERIFIED_WINDOW || '10m', 10 * 60 * 1000),
  },
  securityConfig: {
    jwtSecret,
    jwtRefreshSecret,
    jwtIssuer: process.env.JWT_ISSUER || 'care-system',
    jwtAudience: process.env.JWT_AUDIENCE || 'care-system-api',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshTokenExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    bcryptSaltRounds: Number(process.env.BCRYPT_SALT_ROUNDS || 10),
    rateLimitWindowMinutes: Number(process.env.RATE_LIMIT_WINDOW_MINUTES || 15),
    rateLimitMax: Number(process.env.RATE_LIMIT_MAX || 100),
    geoSearchRadiusMeters: Number(process.env.GEO_SEARCH_RADIUS_METERS || 20000),
  },
};
const bcrypt = require('bcryptjs');
const User = require('../models/userModel');
const Doctor = require('../models/doctorModel');
const Nurse = require('../models/nurseModel');
const {
  BadRequestError,
  ConflictError,
  NotFoundError,
  UnauthorizedError,
  ServiceUnavailableError,
  TooManyRequestsError,
} = require('../errors/appErrors');
const config = require('../config/appConfig');
const { issueToken, verifyToken: verifyAccessToken, revokeToken } = require('./tokenService');
const { resolveProfileImage } = require('../utils/profileImage');
const { sendPasswordResetOtp } = require('./emailService');
const { normalizeGeoPoint } = require('../utils/geoPoint');

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

const PASSWORD_RESET_SUCCESS_MESSAGE =
  'If an account exists for this email, a verification code has been sent.';

const generateOtp = (length) => {
  const min = 10 ** (length - 1);
  const max = 10 ** length - 1;
  return Math.floor(min + Math.random() * (max - min + 1)).toString();
};

const clearPasswordResetState = (user) => {
  user.resetPasswordTokenHash = null;
  user.resetPasswordExpiresAt = null;
  user.resetPasswordAttempts = 0;
  user.resetPasswordVerifiedAt = null;
};

// دالة للتحقق من قوة الباسورد وتحديد النقص بدقة
const validatePasswordStrength = (password) => {
  const errors = [];
  
  if (!password || password.length < 8) {
    errors.push('يجب ألا تقل كلمة المرور عن 8 أحرف');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('يجب أن تحتوي على حرف كابيتال واحد (A-Z) على الأقل');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('يجب أن تحتوي على حرف سمول واحد (a-z) على الأقل');
  }
  if (!/\d/.test(password)) {
    errors.push('يجب أن تحتوي على رقم واحد (0-9) على الأقل');
  }
  if (!/[@$!%*?&]/.test(password)) {
    errors.push('يجب أن تحتوي على رمز خاص واحد على الأقل (مثل @, $, !, %, *, ?, &)');
  }

  if (errors.length > 0) {
    throw new BadRequestError(`كلمة المرور ضعيفة: ${errors.join('، وخاصة ') === errors.join('، ') ? errors.join(' - ') : errors.join(' - ')}`);
  }
};
const getOtpExpiryMinutes = () => Math.max(1, Math.round(config.otpConfig.expiresInMs / 60000));

const sanitizeUser = (userDoc) => {
  const user = userDoc.toObject();
  delete user.passwordHash;
  return user;
};

const attachProfile = async (userDoc) => {
  if (!userDoc) return null;
  const user = sanitizeUser(userDoc);
  if (user.role === 'Doctor') {
    user.profile = await Doctor.findOne({ userId: user._id }).lean();
    user.photo = resolveProfileImage(user.profileImage);
    if (user.profile) user.profile.photo = user.photo;
  }
  if (user.role === 'Nurse') {
    user.profile = await Nurse.findOne({ userId: user._id }).lean();
  }
  return user;
};

const generateTokens = (user) => {
  const basePayload = { id: user._id, role: user.role, email: user.email };
  return {
    accessToken: issueToken({ ...basePayload, tokenType: 'access' }, { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }),
    refreshToken: issueToken({ ...basePayload, tokenType: 'refresh' }, { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '365d' })
  };
};

const refreshAccessToken = async (oldRefreshToken) => {
  try {
    const payload = verifyAccessToken(oldRefreshToken);
    if (payload.tokenType !== 'refresh') {
      throw new UnauthorizedError('Invalid token type');
    }
    const user = await User.findById(payload.id);
    if (!user) throw new NotFoundError('User not found');
    return generateTokens(user);
  } catch (error) {
    throw new UnauthorizedError('Invalid or expired refresh token');
  }
};

const requestPasswordReset = async (email) => {
  const normalizedEmail = normalizeEmail(email);
  const user = await User.findOne({ email: normalizedEmail });

  if (!user) {
    return { message: PASSWORD_RESET_SUCCESS_MESSAGE };
  }

  const now = Date.now();
  if (user.lastOtpSentAt) {
    const elapsedMs = now - user.lastOtpSentAt.getTime();
    const cooldownMs = config.otpConfig.resendCooldownMs;
    if (elapsedMs < cooldownMs) {
      const retryAfterSeconds = Math.ceil((cooldownMs - elapsedMs) / 1000);
      throw new TooManyRequestsError(
        `Please wait ${retryAfterSeconds} seconds before requesting a new code`,
        { retryAfterSeconds }
      );
    }
  }

  const otp = generateOtp(config.otpConfig.length);
  const hash = await bcrypt.hash(otp, config.securityConfig.bcryptSaltRounds);
  const expiryMinutes = getOtpExpiryMinutes();

  user.resetPasswordTokenHash = hash;
  user.resetPasswordExpiresAt = new Date(now + config.otpConfig.expiresInMs);
  user.resetPasswordAttempts = 0;
  user.resetPasswordVerifiedAt = null;
  user.lastOtpSentAt = new Date(now);
  await user.save();

  try {
    await sendPasswordResetOtp({
      to: normalizedEmail,
      otp,
      expiryMinutes,
      userName: user.name,
    });
  } catch (error) {
    clearPasswordResetState(user);
    user.lastOtpSentAt = null;
    await user.save().catch(() => {});

    console.error('[AuthService] Failed to send password reset OTP email:', error.message);
    throw new ServiceUnavailableError('Unable to send verification code. Please try again later.');
  }

  return { message: PASSWORD_RESET_SUCCESS_MESSAGE };
};

const verifyResetOtp = async ({ email, otp }) => {
  const user = await User.findOne({ email: normalizeEmail(email) });
  if (!user || !user.resetPasswordTokenHash) {
    throw new NotFoundError('No reset request found');
  }

  if (!user.resetPasswordExpiresAt || user.resetPasswordExpiresAt < new Date()) {
    clearPasswordResetState(user);
    await user.save();
    throw new BadRequestError('Verification code expired. Please request a new one.');
  }

  if (user.resetPasswordAttempts >= config.otpConfig.maxAttempts) {
    clearPasswordResetState(user);
    await user.save();
    throw new TooManyRequestsError('Maximum verification attempts exceeded. Please request a new code.');
  }

  const isValid = await bcrypt.compare(String(otp), user.resetPasswordTokenHash);
  if (!isValid) {
    user.resetPasswordAttempts += 1;
    await user.save();

    const attemptsLeft = config.otpConfig.maxAttempts - user.resetPasswordAttempts;
    if (attemptsLeft <= 0) {
      clearPasswordResetState(user);
      await user.save();
      throw new TooManyRequestsError('Maximum verification attempts exceeded. Please request a new code.');
    }

    throw new BadRequestError('Invalid verification code', { attemptsLeft });
  }

  user.resetPasswordVerifiedAt = new Date();
  user.resetPasswordAttempts = 0;
  await user.save();
  return true;
};

const resetPassword = async (email, newPassword) => {
  const user = await User.findOne({ email: normalizeEmail(email) });
  if (!user) throw new NotFoundError('User not found');

  if (!user.resetPasswordVerifiedAt) {
    throw new BadRequestError('Please verify the code before resetting your password.');
  }

  const verifiedAgeMs = Date.now() - user.resetPasswordVerifiedAt.getTime();
  if (verifiedAgeMs > config.otpConfig.verifiedWindowMs) {
    clearPasswordResetState(user);
    await user.save();
    throw new BadRequestError('Verification session expired. Please request a new code.');
  }
  validatePasswordStrength(newPassword);
  user.passwordHash = newPassword;
  clearPasswordResetState(user);
  user.lastOtpSentAt = null;
  await user.save();
  return { message: 'Password updated successfully' };
};

const updateProfile = async (userId, updateData) => {
  const allowedUpdates = ['name', 'phoneNumber', 'location', 'profileImage', 'address'];
  const filteredData = {};

  Object.keys(updateData).forEach((key) => { 
    if (allowedUpdates.includes(key)) { 
      filteredData[key] = updateData[key]; 
    } 
  });

  if (filteredData.location) {
    filteredData.location = normalizeGeoPoint(filteredData.location, 'location');
  }

  // التأكد من عدم تكرار رقم التليفون إذا تم تعديله لحساب آخر
  if (filteredData.phoneNumber) {
    const existingUser = await User.findOne({ phoneNumber: filteredData.phoneNumber, _id: { $ne: userId } });
    if (existingUser) {
      throw new ConflictError('رقم الهاتف مستخدم بالفعل بواسطة حساب آخر');
    }
  }

  const user = await User.findById(userId);
  if (!user) throw new NotFoundError('User not found');

  Object.assign(user, filteredData);

  try {
    await user.save();
  } catch (error) {
    if (error?.code === 11000 && error?.keyValue?.phoneNumber) {
      throw new ConflictError('رقم الهاتف مستخدم بالفعل بواسطة حساب آخر');
    }
    throw error;
  }

  return attachProfile(user);
};

const registerUser = async (payload) => {
  const { email, phoneNumber, password, location, specialization, serviceName, workingHours, offDays, basePrice, profileImage, ...otherData } = payload;
  validatePasswordStrength(password);
  const emailNormalized = normalizeEmail(email);
  const normalizedLocation = normalizeGeoPoint(location, 'location');
  
  if (await User.findOne({ email: emailNormalized })) {
    throw new ConflictError('البريد الإلكتروني مستخدم بالفعل');
  }

  if (await User.findOne({ phoneNumber })) {
    throw new ConflictError('رقم الهاتف مستخدم بالفعل لحساب آخر');
  }

  const user = new User({ 
    ...otherData, 
    role: payload.role || 'Patient', 
    email: emailNormalized, 
    phoneNumber,
    passwordHash: password, 
    profileImage, 
    location: normalizedLocation 
  });

  try {
    await user.save();

    if (user.role === 'Doctor') {
      await Doctor.create({
        userId: user._id,
        addedBy: user._id,
        name: user.name,
        phoneNumber: user.phoneNumber,
        address: user.address,
        profileImage: user.profileImage,
        specialization,
        basePrice,
        location: normalizedLocation,
        workingHours,
        offDays,
      });
    }

    if (user.role === 'Nurse') {
      await Nurse.create({
        userId: user._id,
        name: user.name,
        phoneNumber: user.phoneNumber,
        location: normalizedLocation,
        workingHours,
        offDays,
      });
    }
  } catch (error) {
    if (error?.code === 11000) {
      if (error?.keyValue?.email) {
        throw new ConflictError('البريد الإلكتروني مستخدم بالفعل');
      }
      if (error?.keyValue?.phoneNumber) {
        throw new ConflictError('رقم الهاتف مستخدم بالفعل لحساب آخر');
      }
      if (error?.keyValue?.['location.coordinates']) {
        throw new ConflictError('يوجد حساب آخر مسجل بالفعل في هذا الموقع الجغرافي بالضبط');
      }
    }

    await User.deleteOne({ _id: user._id }).catch(() => {});
    throw error;
  }

  return attachProfile(user);
};

module.exports = { 
  registerUser, 

  loginUser: async ({ email, phoneNumber, loginIdentifier, password }) => {
    let query = {};
    if (email) {
      query.email = normalizeEmail(email);
    } else if (phoneNumber) {
      query.phoneNumber = phoneNumber;
    } else if (loginIdentifier) {
      const identifier = String(loginIdentifier).trim();
      if (identifier.includes('@')) {
        query.email = normalizeEmail(identifier);
      } else {
        query.phoneNumber = identifier;
      }
    } else {
      throw new BadRequestError('يرجى إدخال البريد الإلكتروني أو رقم الهاتف تسجيل الدخول');
    }

    const user = await User.findOne(query);
    if (!user || !(await user.comparePassword(password))) {
      throw new UnauthorizedError('بيانات الدخول غير صحيحة');
    }
    return { user: await attachProfile(user), tokens: generateTokens(user) };
  }, 

  getMe: async (id) => attachProfile(await User.findById(id)), 
  requestPasswordReset, 
  verifyResetOtp, 
  resetPassword, 
  updateProfile, 
  validatePasswordStrength,
  revokeToken,
  refreshAccessToken
};
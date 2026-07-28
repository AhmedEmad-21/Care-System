const asyncHandler = require('../utils/asyncHandler');
const authService = require('../services/authService');

const register = asyncHandler(async (req, res) => {
  const user = await authService.registerUser(req.body);
  const authData = await authService.loginUser({ email: user.email, password: req.body.password });
  res.status(201).json({ success: true, data: authData });
});

const login = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await authService.loginUser(req.body) });
});

const resetPassword = asyncHandler(async (req, res) => {
  const result = await authService.requestPasswordReset(req.body.email);
  res.json({ success: true, message: result.message });
});

const verifyOtp = asyncHandler(async (req, res) => {
  await authService.verifyResetOtp(req.body);
  res.json({ success: true, message: 'OTP verified' });
});

const resetPasswordFinal = asyncHandler(async (req, res) => {
  await authService.resetPassword(req.body.email, req.body.newPassword);
  res.json({ success: true, message: 'Password has been reset successfully' });
});

const me = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await authService.getMe(req.user.id || req.user._id) });
});

const updateProfile = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await authService.updateProfile(req.user.id || req.user._id, req.body) });
});

const refreshToken = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ success: false, message: 'Refresh token is required' });
  }
  const result = await authService.refreshAccessToken(refreshToken);
  res.json({ success: true, data: result });
});

const logout = asyncHandler(async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (token) await authService.revokeToken(token);
  res.json({ success: true, message: 'Logged out' });
});

module.exports = { 
  register, 
  login, 
  resetPassword, 
  verifyOtp, 
  resetPasswordFinal, 
  me, 
  updateProfile, 
  refreshToken, 
  logout 
};
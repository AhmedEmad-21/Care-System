const jwt = require('jsonwebtoken');
const config = require('../config/appConfig');

const revokedTokens = new Set();

const signOptions = (tokenType, overrides = {}) => ({
  issuer: config.securityConfig.jwtIssuer,
  audience: config.securityConfig.jwtAudience,
  expiresIn: tokenType === 'refresh'
    ? config.securityConfig.refreshTokenExpiresIn
    : config.securityConfig.jwtExpiresIn,
  ...overrides,
});

const issueToken = (payload, overrides = {}) => {
  const tokenType = payload?.tokenType || 'access';
  const secret = tokenType === 'refresh'
    ? config.securityConfig.jwtRefreshSecret
    : config.securityConfig.jwtSecret;

  return jwt.sign(payload, secret, signOptions(tokenType, overrides));
};

const verifyToken = async (token) => {
  if (revokedTokens.has(token)) {
    const revokedError = new Error('Token revoked');
    revokedError.status = 401;
    revokedError.code = 'TOKEN_REVOKED';
    throw revokedError;
  }

  try {
    return jwt.verify(token, config.securityConfig.jwtSecret, {
      issuer: config.securityConfig.jwtIssuer,
      audience: config.securityConfig.jwtAudience,
    });
  } catch (error) {
    return jwt.verify(token, config.securityConfig.jwtRefreshSecret, {
      issuer: config.securityConfig.jwtIssuer,
      audience: config.securityConfig.jwtAudience,
    });
  }
};

const revokeToken = async (token) => {
  revokedTokens.add(token);
};

module.exports = {
  issueToken,
  verifyToken,
  revokeToken,
};
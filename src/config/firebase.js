require('dotenv').config();

const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

let privateKey = process.env.FIREBASE_PRIVATE_KEY;

if (privateKey) {
  privateKey = privateKey.replace(/^['"]|['"]$/g, '');
  privateKey = privateKey.replace(/\\n/g, '\n');
}

if (!getApps().length) {
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && privateKey) {
    try {
      initializeApp({
        credential: cert({
          project_id: process.env.FIREBASE_PROJECT_ID,
          client_email: process.env.FIREBASE_CLIENT_EMAIL,
          private_key: privateKey,
        }),
      });
    } catch (err) {
      console.error('[Firebase] Initialization failed:', err.message);
    }
  } else {
    console.warn('[Firebase] Firebase Admin credentials not fully configured in .env');
  }
}

/**
 * Generates a Firebase Custom Token using Firebase Admin SDK
 * @param {string|Object} userId - MongoDB user ID (_id)
 * @param {Object} [customClaims={}] - Optional developer claims (e.g. role, email)
 * @returns {Promise<string|null>} Custom token string or null if failed/unconfigured
 */
const generateFirebaseCustomToken = async (userId, customClaims = {}) => {
  if (!getApps().length) {
    return null;
  }
  try {
    const uid = userId ? userId.toString() : '';
    if (!uid) return null;
    const token = await getAuth().createCustomToken(uid, customClaims);
    return token;
  } catch (error) {
    console.error('[Firebase] Error generating custom token for uid', userId, ':', error.message);
    return null;
  }
};

module.exports = { getApps, generateFirebaseCustomToken };
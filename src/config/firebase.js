require('dotenv').config();

const { initializeApp, getApps, cert } = require('firebase-admin/app');

let privateKey = process.env.FIREBASE_PRIVATE_KEY;

if (privateKey) {
  privateKey = privateKey.replace(/^['"]|['"]$/g, '');
  privateKey = privateKey.replace(/\\n/g, '\n');
}

if (!getApps().length) {
  initializeApp({
    credential: cert({
      project_id: process.env.FIREBASE_PROJECT_ID,
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      private_key: privateKey,
    }),
  });
}

module.exports = { getApps };
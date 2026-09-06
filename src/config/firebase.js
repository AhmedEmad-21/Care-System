const { initializeApp, getApps, cert } = require('firebase-admin/app');
const serviceAccount = require('./tabibak-ai-firebase-adminsdk-fbsvc-ceb7855a6e.json');

if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount),
  });
}

module.exports = { getApps };
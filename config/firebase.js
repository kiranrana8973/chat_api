const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const serviceAccountPath = path.join(__dirname, '..', 'serviceAccountKey.json');

if (fs.existsSync(serviceAccountPath)) {
  const serviceAccount = require(serviceAccountPath);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  console.log('Firebase Admin SDK initialized.');
  module.exports = admin;
} else {
  console.warn(
    'WARNING: serviceAccountKey.json not found. Push notifications are disabled.'
  );
  console.warn(
    'Download it from Firebase Console > Project Settings > Service Accounts.'
  );
  module.exports = null;
}

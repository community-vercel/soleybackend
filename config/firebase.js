const admin = require('firebase-admin');
require('dotenv').config();

if (!admin.apps.length) {
  try {
    const requiredVars = [
      'FIREBASE_PROJECT_ID',
      'FIREBASE_CLIENT_EMAIL',
      'FIREBASE_PRIVATE_KEY'
    ];
    const missingVars = requiredVars.filter(v => !process.env[v]);
    if (missingVars.length > 0) {
      throw new Error(`Missing required env vars: ${missingVars.join(', ')}`);
    }

    let privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!privateKey) throw new Error('FIREBASE_PRIVATE_KEY is not defined');

    // ✅ Works both locally (.env) and on Vercel
    privateKey = privateKey
      .replace(/^"|"$/g, '')   // strip wrapping quotes if any
      .replace(/\\n/g, '\n');  // turn literal \n into newlines

    const serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    };

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    console.log('✅ Firebase Admin initialized');
  } catch (error) {
    console.error('❌ Firebase Admin init failed:', error.message);
    throw error;
  }
} else {
  console.log('ℹ️ Firebase Admin already initialized');
}

module.exports = admin;

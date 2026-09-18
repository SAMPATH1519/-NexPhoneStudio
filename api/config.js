/**
 * Public Client Configuration API Endpoint
 * Safely provides public client configuration (e.g. Firebase Web Config) to the frontend
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const apiKey = process.env.FIREBASE_API_KEY ? process.env.FIREBASE_API_KEY.trim() : '';
  const projectId = process.env.FIREBASE_PROJECT_ID ? process.env.FIREBASE_PROJECT_ID.trim() : '';

  const firebaseConfig = {
    apiKey,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN ? process.env.FIREBASE_AUTH_DOMAIN.trim() : '',
    projectId,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET ? process.env.FIREBASE_STORAGE_BUCKET.trim() : '',
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID ? process.env.FIREBASE_MESSAGING_SENDER_ID.trim() : '',
    appId: process.env.FIREBASE_APP_ID ? process.env.FIREBASE_APP_ID.trim() : ''
  };

  const isFirebaseConfigured = Boolean(
    apiKey &&
    !apiKey.includes('your_firebase_api_key_here') &&
    projectId &&
    !projectId.includes('your_project_id')
  );

  return res.status(200).json({
    storeName: process.env.STORE_NAME || 'NexPhone Studio',
    firebase: firebaseConfig,
    isFirebaseConfigured
  });
}

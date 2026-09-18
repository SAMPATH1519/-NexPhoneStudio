/**
 * Firebase Client Service for NexPhone Studio
 * Integrates Firebase Authentication (Google Sign-In & Email/Password)
 * and Cloud Firestore for storing customer orders in the cloud.
 * 
 * Uses official Firebase Modular SDK v10 via CDN.
 */

let app = null;
let auth = null;
let db = null;
let googleProvider = null;
let isConfigured = false;
let authModules = null;
let firestoreModules = null;

/**
 * Initialize Firebase from /api/config or window.FIREBASE_CONFIG
 */
export async function initFirebase() {
  if (app) return { isConfigured, app, auth, db };

  try {
    let config = window.FIREBASE_CONFIG;
    if (!config) {
      const res = await fetch('/api/config');
      if (res.ok) {
        const data = await res.json();
        if (data.isFirebaseConfigured) {
          config = data.firebase;
        }
      }
    }

    if (!config || !config.apiKey || !config.projectId) {
      console.log('Firebase not configured. Running in local SQLite mode.');
      isConfigured = false;
      return { isConfigured: false };
    }

    // Import official Firebase Modular SDK from CDN
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
    authModules = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
    firestoreModules = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');

    app = initializeApp(config);
    auth = authModules.getAuth(app);
    db = firestoreModules.getFirestore(app);
    googleProvider = new authModules.GoogleAuthProvider();
    isConfigured = true;

    console.log('🔥 Firebase successfully connected to project:', config.projectId);
    return { isConfigured: true, app, auth, db };
  } catch (err) {
    console.warn('Firebase initialization error, fallback active:', err.message);
    isConfigured = false;
    return { isConfigured: false, error: err.message };
  }
}

export function isFirebaseActive() {
  return isConfigured && auth !== null;
}

/**
 * 1-Click Google Sign-In with popup
 */
export async function signInWithGoogle() {
  if (!isFirebaseActive()) throw new Error('Firebase is not configured yet. Add your Firebase keys to connect.');
  const result = await authModules.signInWithPopup(auth, googleProvider);
  const user = result.user;
  return {
    id: user.uid,
    name: user.displayName || user.email.split('@')[0],
    email: user.email,
    photoURL: user.photoURL
  };
}

/**
 * Email & Password Registration
 */
export async function signUpWithEmail(name, email, password) {
  if (!isFirebaseActive()) throw new Error('Firebase is not configured yet.');
  const userCredential = await authModules.createUserWithEmailAndPassword(auth, email, password);
  if (name && authModules.updateProfile) {
    await authModules.updateProfile(userCredential.user, { displayName: name });
  }
  return {
    id: userCredential.user.uid,
    name: name || userCredential.user.email.split('@')[0],
    email: userCredential.user.email
  };
}

/**
 * Email & Password Login
 */
export async function loginWithEmail(email, password) {
  if (!isFirebaseActive()) throw new Error('Firebase is not configured yet.');
  const userCredential = await authModules.signInWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;
  return {
    id: user.uid,
    name: user.displayName || user.email.split('@')[0],
    email: user.email
  };
}

/**
 * Sign Out
 */
export async function logoutFirebase() {
  if (!isFirebaseActive()) return;
  await authModules.signOut(auth);
}

/**
 * Save Order to Cloud Firestore 'orders' collection
 */
export async function saveOrderToFirestore(orderData) {
  if (!isFirebaseActive() || !db) return null;
  try {
    const docRef = await firestoreModules.addDoc(firestoreModules.collection(db, 'orders'), {
      ...orderData,
      createdAt: firestoreModules.serverTimestamp()
    });
    return docRef.id;
  } catch (err) {
    console.warn('Could not write order to Firestore:', err);
    return null;
  }
}

/**
 * Get User Orders from Cloud Firestore
 */
export async function getFirestoreOrders(userId) {
  if (!isFirebaseActive() || !db) return [];
  try {
    const q = firestoreModules.query(
      firestoreModules.collection(db, 'orders'),
      firestoreModules.where('userId', '==', userId)
    );
    const querySnapshot = await firestoreModules.getDocs(q);
    const orders = [];
    querySnapshot.forEach(doc => {
      orders.push({ id: doc.id, ...doc.data() });
    });
    return orders;
  } catch (err) {
    console.warn('Could not read orders from Firestore:', err);
    return [];
  }
}

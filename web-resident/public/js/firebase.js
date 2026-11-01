// Firebase setup and sign-in (Spark plan: Authentication + Firestore only).
// The SDK is loaded straight from Google's CDN, so the web apps still need no build step.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js';
import {
  connectAuthEmulator, getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut,
} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js';
import { connectFirestoreEmulator, doc, getDoc, getFirestore } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js';
import { APP_ROLE, EMULATOR_PROJECT, USE_EMULATORS, firebaseConfig } from './config.js';

export const firebaseOptions = USE_EMULATORS
  ? { ...firebaseConfig, apiKey: 'fake-api-key', projectId: EMULATOR_PROJECT }
  : firebaseConfig;

export const isConfigured = USE_EMULATORS || !String(firebaseConfig.apiKey).startsWith('YOUR_');

const app = initializeApp(firebaseOptions);
export const auth = getAuth(app);
export const db = getFirestore(app);

if (USE_EMULATORS) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}

const LOGIN_ERRORS = {
  'auth/invalid-credential': 'Incorrect email or password',
  'auth/invalid-email': 'Enter a valid email address',
  'auth/user-disabled': 'This account has been disabled',
  'auth/too-many-requests': 'Too many attempts. Please try again later',
  'auth/network-request-failed': 'Cannot reach Firebase. Check your internet connection',
};

let currentProfile = null;

/** The signed-in user's profile ({ id, name, role, ... }) or null. */
export const getProfile = () => currentProfile;

async function loadProfile(user) {
  const snap = await getDoc(doc(db, 'users', user.uid));
  return snap.exists() ? { id: user.uid, ...snap.data() } : null;
}

/** Calls `cb(profile)` with the signed-in user's profile (for this portal's role), or null when signed out. */
export function onSession(cb) {
  return onAuthStateChanged(auth, async (user) => {
    let profile = null;
    // A brand-new resident has no profile for a moment (it is written right after sign-up), so retry briefly.
    for (let attempt = 0; user && attempt < 4 && !profile; attempt++) {
      if (attempt) await new Promise((r) => setTimeout(r, 400));
      profile = await loadProfile(user).catch(() => null);
    }
    if (user && profile?.role !== APP_ROLE) {
      await signOut(auth);
      profile = null;
    }
    currentProfile = profile;
    cb(profile);
  });
}

export async function login(email, password) {
  try {
    const { user } = await signInWithEmailAndPassword(auth, email, password);
    const profile = await loadProfile(user);
    if (profile?.role !== APP_ROLE) {
      await signOut(auth);
      throw new Error(`This portal is for ${APP_ROLE} accounts only.`);
    }
    return profile;
  } catch (err) {
    throw new Error(LOGIN_ERRORS[err.code] || err.message);
  }
}

export const logout = () => signOut(auth);

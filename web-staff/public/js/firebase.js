// Firebase setup and sign-in (Spark plan: Authentication + Firestore only).
// The SDK is loaded straight from Google's CDN, so the web apps still need no build step.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js';
import {
  connectAuthEmulator, EmailAuthProvider, getAuth, onAuthStateChanged, reauthenticateWithCredential, signInWithEmailAndPassword, signOut,
  verifyBeforeUpdateEmail,
} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js';
import { connectFirestoreEmulator, doc, getDoc, getFirestore, updateDoc } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js';
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
  'auth/unauthorized-domain': 'This web address is not allowed to sign in yet. In the Firebase console go to Authentication > Settings > Authorized domains and add it.',
  'auth/network-request-failed': 'Cannot reach Firebase. Check your internet connection',
};

let currentProfile = null;

/** The signed-in user's profile ({ id, name, role, ... }) or null. */
export const getProfile = () => currentProfile;

async function loadProfile(user) {
  const snap = await getDoc(doc(db, 'users', user.uid));
  return snap.exists() ? { id: user.uid, ...snap.data() } : null;
}

/**
 * Calls `cb(profile, problem)`:
 *  - profile = the signed-in user's profile when it has this portal's role;
 *  - profile = null when signed out, or when the account cannot use this portal.
 *    In that case `problem` explains why (and the user is signed out again).
 */
export function onSession(cb) {
  return onAuthStateChanged(auth, async (user) => {
    if (!user) {
      currentProfile = null;
      return cb(null);
    }

    let profile = null;
    let failure = null;
    // A brand-new resident has no profile for a moment (it is written right after sign-up), so retry briefly.
    for (let attempt = 0; attempt < 4 && !profile && !failure; attempt++) {
      if (attempt) await new Promise((r) => setTimeout(r, 400));
      try {
        profile = await loadProfile(user);
      } catch (err) {
        failure = err;
      }
    }

    if (profile?.role === APP_ROLE) {
      // The profile is only usable if its field names are exact (a typo or a trailing space is easy to make in the console).
      const stray = Object.keys(profile).find((k) => k !== k.trim());
      if (typeof profile.name !== 'string' || !profile.name.trim() || stray) {
        const why = stray
          ? `the field "${stray}" has an extra space in its name`
          : 'the field "name" is missing';
        currentProfile = null;
        await signOut(auth);
        return cb(null, `Your profile document (users/${user.uid}) is not correct: ${why}. In the Firebase console, delete that field and add it again, typing the name exactly ("name", "email", "role", "created_at") with no spaces.`);
      }
      // After the user confirmed a new login email, copy it into the profile too.
      if (user.email && profile.email?.toLowerCase() !== user.email.toLowerCase()) {
        try {
          await updateDoc(doc(db, 'users', user.uid), { email: user.email });
          profile = { ...profile, email: user.email };
        } catch {
          /* not critical: it is retried at the next sign-in */
        }
      }
      currentProfile = profile;
      return cb(profile);
    }

    let problem;
    if (failure?.code === 'permission-denied') {
      problem = 'Signed in, but the profile could not be read (permission denied). Publish the rules: run "npm run deploy" inside the firebase folder.';
    } else if (failure) {
      problem = `Signed in, but the profile could not be loaded: ${failure.message}`;
    } else if (!profile) {
      problem = `Signed in as ${user.email}, but this account has no profile yet. In the Firebase console open Firestore Database, collection "users", and add a document whose ID is exactly ${user.uid} with the fields name (string), email (string), role (string) = "${APP_ROLE}" and created_at (timestamp).`;
    } else {
      problem = `This portal is for ${APP_ROLE} accounts only. This account's role is "${profile.role}".`;
    }
    currentProfile = null;
    await signOut(auth);
    cb(null, problem);
  });
}

/** Sign in. Whether the account may use this portal is decided by onSession(). */
export async function login(email, password) {
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    throw new Error(LOGIN_ERRORS[err.code] || err.message);
  }
}

export const logout = () => signOut(auth);

/** Reload the signed-in user's profile (call after the user edits their own info). */
export async function refreshProfile() {
  const user = auth.currentUser;
  if (!user) return null;
  const fresh = await loadProfile(user);
  if (fresh) currentProfile = fresh;
  return currentProfile;
}

const EMAIL_ERRORS = {
  'auth/invalid-credential': 'Wrong password.',
  'auth/wrong-password': 'Wrong password.',
  'auth/email-already-in-use': 'That email is already used by another account.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/too-many-requests': 'Too many attempts. Please try again later.',
  'auth/requires-recent-login': 'Please sign out, sign in again, then retry.',
  'auth/operation-not-allowed': 'Changing email is not enabled for this project.',
  'auth/unauthorized-continue-uri': 'This web address is not allowed yet. Add it under Authentication > Settings > Authorized domains.',
};

/**
 * Change the login email: re-check the password, then send a confirmation link to the NEW address.
 * The email only changes once the link is opened. Returns the address the link was sent to.
 */
export async function requestEmailChange(newEmail, password) {
  const user = auth.currentUser;
  const email = (newEmail || '').trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Enter a valid email address.');
  if (email === user.email.toLowerCase()) throw new Error('That is already your email.');
  try {
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
    await verifyBeforeUpdateEmail(user, email);
  } catch (err) {
    throw new Error(EMAIL_ERRORS[err.code] || err.message);
  }
  return email;
}

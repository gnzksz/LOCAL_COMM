// Firebase setup and sign-in (Spark plan: Authentication + Firestore only).
// The SDK is loaded straight from Google's CDN, so the web apps still need no build step.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js';
import {
  connectAuthEmulator, createUserWithEmailAndPassword, EmailAuthProvider, getAuth, onAuthStateChanged, reauthenticateWithCredential, signInWithEmailAndPassword, signOut,
  verifyBeforeUpdateEmail,
} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js';
import { connectFirestoreEmulator, doc, getDoc, getFirestore, serverTimestamp, setDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js';
import { APP_ROLE, EMULATOR_PROJECT, LOGIN_URL, PORTALS, USE_EMULATORS, firebaseConfig } from './config.js';

export const firebaseOptions = USE_EMULATORS
  ? { ...firebaseConfig, apiKey: 'fake-api-key', projectId: EMULATOR_PROJECT }
  : firebaseConfig;

export const isConfigured = USE_EMULATORS || !String(firebaseConfig.apiKey).startsWith('YOUR_');

// Every page of the site (sign-in page and the three areas) shares one saved login.
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

// A reason the sign-in page should show (set by the areas when they have to send someone back).
const NOTICE_KEY = 'localcomm_notice';
const stashNotice = (text) => {
  try { sessionStorage.setItem(NOTICE_KEY, text); } catch { /* private mode */ }
};
export function consumeNotice() {
  try {
    const text = sessionStorage.getItem(NOTICE_KEY) || '';
    sessionStorage.removeItem(NOTICE_KEY);
    return text;
  } catch {
    return '';
  }
}

/** Why a signed-in account cannot be used, or '' when its profile is fine. */
function profileProblem(user, profile, failure) {
  if (failure?.code === 'permission-denied') {
    return 'Signed in, but the profile could not be read (permission denied). Publish the rules: run "npm run deploy" inside the firebase folder.';
  }
  if (failure) return `Signed in, but the profile could not be loaded: ${failure.message}`;
  if (!profile) {
    return `Signed in as ${user.email}, but this account has no profile yet. In the Firebase console open Firestore Database, collection "users", and add a document whose ID is exactly ${user.uid} with the fields name (string), email (string), role (string) = "admin", "staff" or "resident", and created_at (timestamp).`;
  }
  if (!PORTALS[profile.role]) {
    return `This account's role is "${profile.role}". It must be exactly admin, staff or resident (check the field "role" in users/${user.uid}).`;
  }
  // field names must be exact: a trailing space ("name ") is easy to type in the console
  const stray = Object.keys(profile).find((k) => k !== k.trim());
  if (typeof profile.name !== 'string' || !profile.name.trim() || stray) {
    const why = stray ? `the field "${stray}" has an extra space in its name` : 'the field "name" is missing';
    return `Your profile document (users/${user.uid}) is not correct: ${why}. In the Firebase console, delete that field and add it again, typing the name exactly ("name", "email", "role", "created_at") with no spaces.`;
  }
  return '';
}

/**
 * One sign-in for everybody. Pages call this with their own role (APP_ROLE):
 *  - the sign-in page (APP_ROLE "login") calls `cb(null, problem?)` while nobody is signed in, and sends
 *    a signed-in user to their own area (admin -> /admin/, staff -> /staff/, resident -> /resident/);
 *  - an area calls `cb(profile)` only for a user of its own role. Nobody signed in goes to the sign-in
 *    page, and a user of another role is sent to the area where they belong.
 */
export function onSession(cb) {
  return onAuthStateChanged(auth, async (user) => {
    if (!user) {
      currentProfile = null;
      if (APP_ROLE === 'login') return cb(null);
      return location.replace(LOGIN_URL);
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

    const problem = profileProblem(user, profile, failure);
    if (problem) {
      currentProfile = null;
      if (APP_ROLE !== 'login') stashNotice(problem);
      await signOut(auth); // the listener runs again signed out: the sign-in page shows it, areas go there
      if (APP_ROLE === 'login') cb(null, problem);
      return;
    }

    if (profile.role !== APP_ROLE) return location.replace(PORTALS[profile.role]);

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
    cb(profile);
  });
}

/** Sign in. Where the user lands is decided by onSession() from their role. */
export async function login(email, password) {
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    throw new Error(LOGIN_ERRORS[err.code] || err.message);
  }
}

const SIGNUP_ERRORS = {
  'auth/email-already-in-use': 'That email is already registered. Try signing in instead.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/weak-password': 'Password must be at least 6 characters.',
  'auth/network-request-failed': 'Cannot reach Firebase. Check your internet connection.',
};

/** Resident self-registration with email + password. Staff and admins are created by an admin. */
export async function registerResident({ name, email, password }) {
  const cleanName = (name || '').trim();
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanName) throw new Error('Name is required');
  let uid;
  try {
    uid = (await createUserWithEmailAndPassword(auth, cleanEmail, password)).user.uid;
  } catch (err) {
    throw new Error(SIGNUP_ERRORS[err.code] || err.message);
  }
  await setDoc(doc(db, 'users', uid), { name: cleanName, email: cleanEmail, role: 'resident', created_at: serverTimestamp() });
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

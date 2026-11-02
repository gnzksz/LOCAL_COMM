// Firebase setup and sign-in (Spark plan: Authentication + Firestore only).
// The SDK is loaded straight from Google's CDN, so the web apps still need no build step.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js';
import {
  browserLocalPersistence, browserSessionPersistence, connectAuthEmulator, createUserWithEmailAndPassword, EmailAuthProvider, getAuth,
  onAuthStateChanged, reauthenticateWithCredential, sendEmailVerification, sendPasswordResetEmail, setPersistence, signInWithEmailAndPassword,
  signOut, verifyBeforeUpdateEmail,
} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js';
import { connectFirestoreEmulator, doc, getDoc, getFirestore, serverTimestamp, setDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js';
import { APP_CHECK_SITE_KEY, APP_ROLE, EMULATOR_PROJECT, LOGIN_URL, PORTALS, USE_EMULATORS, firebaseConfig } from './config.js';
import { passwordProblem } from './password.js';

export const firebaseOptions = USE_EMULATORS
  ? { ...firebaseConfig, apiKey: 'fake-api-key', projectId: EMULATOR_PROJECT }
  : firebaseConfig;

export const isConfigured = USE_EMULATORS || !String(firebaseConfig.apiKey).startsWith('YOUR_');

// Every page of the site (sign-in page and the three areas) shares one saved login.
const app = initializeApp(firebaseOptions);

// App Check (optional): proves that requests come from this site and not from a script. It stays off until a
// reCAPTCHA v3 site key is set in config.js. On localhost it uses a debug token (printed in the browser console).
if (APP_CHECK_SITE_KEY && !USE_EMULATORS) {
  try {
    if (location.hostname === 'localhost') self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    const { initializeAppCheck, ReCaptchaV3Provider } = await import('https://www.gstatic.com/firebasejs/13.1.0/firebase-app-check.js');
    initializeAppCheck(app, { provider: new ReCaptchaV3Provider(APP_CHECK_SITE_KEY), isTokenAutoRefreshEnabled: true });
  } catch (err) {
    console.warn('App Check could not start:', err);
  }
}

export const auth = getAuth(app);
export const db = getFirestore(app);

if (USE_EMULATORS) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}

// One message for "no such account" and "wrong password", so the form cannot be used to find out which emails are registered.
const BAD_CREDENTIALS = 'Incorrect email or password.';
const LOGIN_ERRORS = {
  'auth/invalid-credential': BAD_CREDENTIALS,
  'auth/user-not-found': BAD_CREDENTIALS,
  'auth/wrong-password': BAD_CREDENTIALS,
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/user-disabled': 'This account cannot sign in. Please contact the barangay office.',
  'auth/too-many-requests': 'Too many attempts. Please wait a few minutes and try again.',
  'auth/unauthorized-domain': 'This web address is not allowed to sign in yet. In the Firebase console go to Authentication > Settings > Authorized domains and add it.',
  'auth/network-request-failed': 'Cannot reach Firebase. Check your internet connection.',
};

let currentProfile = null;

/** The signed-in user's profile ({ id, name, role, emailVerified, ... }) or null. */
export const getProfile = () => currentProfile;

async function loadProfile(user) {
  const snap = await getDoc(doc(db, 'users', user.uid));
  return snap.exists() ? { id: user.uid, ...snap.data() } : null;
}

// A reason the sign-in page should show (set by the areas when they have to send someone back).
const NOTICE_KEY = 'localcomm_notice';
export const stashNotice = (text) => {
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

// Set by login() so onSession() knows this sign-in was typed in just now (not a saved session),
// and which role tab the person chose on the sign-in page.
let freshLogin = false;
let expectedRole = null;

const ROLE_NAMES = { admin: 'Admin', staff: 'Staff', resident: 'Resident' };

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
      freshLogin = false;
      expectedRole = null;
      if (APP_ROLE !== 'login') stashNotice(problem);
      await signOut(auth); // the listener runs again signed out: the sign-in page shows it, areas go there
      if (APP_ROLE === 'login') cb(null, problem);
      return;
    }

    if (APP_ROLE === 'login') {
      // The person picked a role tab but the account belongs to another role: say so instead of silently moving them.
      if (expectedRole && profile.role !== expectedRole) {
        const mine = ROLE_NAMES[profile.role];
        expectedRole = null;
        freshLogin = false;
        await signOut(auth);
        return cb(null, `That account is a ${mine} account. Choose the "${mine}" tab above and sign in again.`);
      }
      // A sign-in typed in just now: remember when. "previous" keeps the sign-in before this one for the profile page.
      if (freshLogin) {
        freshLogin = false;
        try {
          await updateDoc(doc(db, 'users', user.uid), { previous_login_at: profile.last_login_at ?? null, last_login_at: serverTimestamp() });
        } catch {
          /* not critical: the sign-in itself worked */
        }
      }
      expectedRole = null;
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
    currentProfile = { ...profile, emailVerified: user.emailVerified };
    cb(currentProfile);
  });
}

/**
 * Sign in. Where the user lands is decided by onSession() from their role.
 * remember: keep the login after the browser is closed (otherwise it ends with the tab).
 * role: the tab chosen on the sign-in page; an account of another role is refused with an explanation.
 */
export async function login(email, password, { remember = true, role = null } = {}) {
  try {
    await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
    freshLogin = true;
    expectedRole = role;
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    freshLogin = false;
    expectedRole = null;
    throw Object.assign(new Error(LOGIN_ERRORS[err.code] || 'Could not sign in. Please try again.'), { code: err.code });
  }
}

const SIGNUP_ERRORS = {
  // the same words for every failure that could reveal an existing account
  'auth/email-already-in-use': 'We could not create an account with those details. If you already registered, sign in or use "Forgot password?".',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/weak-password': 'That password is too weak. Use at least 8 characters, with a letter and a number.',
  'auth/network-request-failed': 'Cannot reach Firebase. Check your internet connection.',
};

/** Resident self-registration with email + password. Staff and admins are created by an admin. */
export async function registerResident({ name, email, password }) {
  const cleanName = (name || '').trim();
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanName) throw new Error('Name is required');
  const weak = passwordProblem(password);
  if (weak) throw new Error(weak);
  let user;
  try {
    user = (await createUserWithEmailAndPassword(auth, cleanEmail, password)).user;
  } catch (err) {
    throw new Error(SIGNUP_ERRORS[err.code] || 'Could not create the account. Please try again.');
  }
  await setDoc(doc(db, 'users', user.uid), { name: cleanName, email: cleanEmail, role: 'resident', created_at: serverTimestamp() });
  // The confirmation email: if it fails here, the resident can ask for it again on the "Verify your email" screen.
  try {
    await sendEmailVerification(user);
  } catch {
    /* resend is offered in the app */
  }
}

export const logout = () => signOut(auth);

// ---- Email verification (residents must confirm their email before sending reports) -----------------------------

const VERIFY_ERRORS = {
  'auth/too-many-requests': 'Too many emails were requested. Please wait a few minutes before asking again.',
  'auth/network-request-failed': 'Cannot reach Firebase. Check your internet connection.',
};

/** Send (or send again) the confirmation link to the signed-in user's email. */
export async function sendVerification() {
  const user = auth.currentUser;
  if (!user) throw new Error('Please sign in again.');
  try {
    await sendEmailVerification(user);
  } catch (err) {
    throw new Error(VERIFY_ERRORS[err.code] || 'The email could not be sent. Please try again in a moment.');
  }
}

/**
 * Ask Firebase whether the email was confirmed since the page was opened. When it was, the login token is refreshed
 * too, because the Firestore rules read "email verified" from that token. Returns true or false.
 */
export async function checkVerified() {
  const user = auth.currentUser;
  if (!user) return false;
  await user.reload();
  if (user.emailVerified) {
    await user.getIdToken(true);
    if (currentProfile) currentProfile = { ...currentProfile, emailVerified: true };
  }
  return user.emailVerified;
}

// ---- Forgot password ---------------------------------------------------------------------------------------------

/**
 * Send a password reset link. It never says whether the email has an account: unknown addresses look exactly like
 * known ones. Only problems that say nothing about the account (no internet, too many requests) are reported.
 */
export async function sendPasswordReset(email) {
  try {
    await sendPasswordResetEmail(auth, (email || '').trim());
  } catch (err) {
    if (err.code === 'auth/network-request-failed') throw new Error('Cannot reach Firebase. Check your internet connection.');
    if (err.code === 'auth/too-many-requests') throw new Error('Too many requests. Please wait a few minutes and try again.');
    /* user-not-found, invalid-email, ...: stay silent */
  }
}

/** Reload the signed-in user's profile (call after the user edits their own info). */
export async function refreshProfile() {
  const user = auth.currentUser;
  if (!user) return null;
  const fresh = await loadProfile(user);
  if (fresh) currentProfile = { ...fresh, emailVerified: user.emailVerified };
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

/** Check the password of the signed-in user again, before a sensitive action. Throws a readable error when it is wrong. */
export async function reauthenticate(password) {
  const user = auth.currentUser;
  if (!user) throw new Error('Please sign in again.');
  try {
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
  } catch (err) {
    throw new Error(EMAIL_ERRORS[err.code] || 'Could not check your password. Please try again.');
  }
}

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

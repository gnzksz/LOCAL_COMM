export const APP_ROLE = 'staff';

// One site: the landing page is at "/", the single sign-in page at "/login/", and each role has its own area.
export const HOME_URL = '/';
export const LOGIN_URL = '/login/';
export const PORTALS = { admin: '/admin/', staff: '/staff/', resident: '/resident/' };

// Paste your web app config here:
// Firebase console > Project settings > General > Your apps > Web app > SDK setup and configuration
export const firebaseConfig = {
  apiKey: 'AIzaSyB3Fi3H5ZlG1v_xBEPbm40RuUW-Xl6JX0g',
  authDomain: 'local-comm-bdae9.firebaseapp.com',
  projectId: 'local-comm-bdae9',
  storageBucket: 'local-comm-bdae9.firebasestorage.app',
  messagingSenderId: '403437484683',
  appId: '1:403437484683:web:e75193411f61c8b939f28e',
};

// Firebase App Check (optional protection against bots). Leave empty to keep it off.
// Setup: README "Login security" > App Check. Paste the reCAPTCHA v3 SITE key (not the secret) here.
export const APP_CHECK_SITE_KEY = '';

// Signed out after this many seconds without activity (a warning appears 60 seconds before).
export const IDLE_SECONDS = 900;

// Open the page with ?emulator to talk to the local Firebase emulators (npm run emulators in /firebase).
const params = new URLSearchParams(location.search);
if (params.has('emulator')) sessionStorage.setItem('localcomm_emulator', '1');
if (params.get('emulator') === 'off') sessionStorage.removeItem('localcomm_emulator');
export const USE_EMULATORS = sessionStorage.getItem('localcomm_emulator') === '1';

export const EMULATOR_PROJECT = 'demo-local-comm';

export const ISSUE_TYPES = [
  'Garbage / Waste Collection',
  'Road Damage / Potholes',
  'Streetlight',
  'Drainage / Flooding',
  'Water Supply',
  'Noise / Disturbance',
  'Stray Animals',
  'Other',
];

export const STATUSES = ['Pending', 'Assigned', 'In Progress', 'Resolved', 'Rejected', 'Archived'];

import { consumeNotice, isConfigured, login, onSession, registerResident, sendPasswordReset } from './firebase.js';
import { attemptsLeft, lockedSeconds, recordFailure, resetFailures } from './lockout.js';
import { passwordProblem } from './password.js';
import {
  authScreen, html, icon, passwordField, render, setFieldError, strengthMeter, validateForm, wireAuthTheme, wireStrength,
} from './ui.js';

// The one sign-in page for everybody. After signing in, onSession() sends each person to their own area
// (admin -> /admin/, staff -> /staff/, resident -> /resident/). Only residents can create an account here.
const app = document.getElementById('app');

const ROLES = [
  ['resident', 'Resident'],
  ['staff', 'Staff'],
  ['admin', 'Admin'],
];
const ROLE_KEY = 'lcs_login_role';
const CREDENTIAL_CODES = ['auth/invalid-credential', 'auth/user-not-found', 'auth/wrong-password'];

const store = {
  get: (k) => {
    try { return sessionStorage.getItem(k); } catch { return null; }
  },
  set: (k, v) => {
    try { sessionStorage.setItem(k, v); } catch { /* private mode */ }
  },
};

let mode = new URLSearchParams(location.search).get('mode') === 'register' ? 'register' : 'login';
const wanted = new URLSearchParams(location.search).get('role') || store.get(ROLE_KEY);
let role = ROLES.some(([key]) => key === wanted) ? wanted : 'resident';
let notice = consumeNotice(); // e.g. why an area sent the user back here
let countdown = null;

const COPY = {
  login: {
    resident: 'Sign in to send a report with a photo and location, and follow it until it is fixed.',
    staff: 'Sign in to see the reports assigned to you and update their progress.',
    admin: 'Sign in to review, assign and follow up every report of the barangay.',
  },
  register: 'Create a free resident account to send reports with a photo and location, and follow each one until it is fixed.',
  forgot: 'Enter your email and we will send you a link to choose a new password.',
};

const roleTabs = () => html`
  <div class="role-tabs" role="tablist" aria-label="Sign in as">
    ${ROLES.map(([key, label]) => html`<button type="button" role="tab" id="tab-${key}" data-role="${key}" aria-selected="${String(key === role)}" tabindex="${key === role ? 0 : -1}">${label}</button>`)}
  </div>`;

const emailField = (autocomplete) => html`
  <div class="field"><label for="email">Email</label>
    <div class="input-wrap">${icon('mail')}<input id="email" name="email" type="email" autocomplete="${autocomplete}" placeholder="you@example.com" required /></div></div>`;

function formMarkup() {
  const banner = html`<p class="form-error" id="banner" role="alert" aria-live="assertive" ${notice ? '' : 'hidden'}>${notice}</p>`;
  const submit = (label) => html`<button class="btn btn-primary btn-lg" type="submit"><span>${label}</span></button>`;

  if (mode === 'register') {
    return html`
      <form class="card login-card" id="login" novalidate>
        <div class="login-badge">${icon('user')}</div>
        <h1>Create your account</h1>
        <p class="muted sub">Register as a resident</p>
        <div class="field"><label for="name">Full name</label>
          <div class="input-wrap">${icon('user')}<input id="name" name="name" autocomplete="name" placeholder="Juan Dela Cruz" maxlength="100" required /></div></div>
        ${emailField('email')}
        ${passwordField({ id: 'password', label: 'Password', autocomplete: 'new-password', placeholder: 'Choose a password' })}
        ${strengthMeter()}
        ${banner}
        ${submit('Create account')}
        <p class="login-help"><a href="#" id="to-login">Already have an account? Sign in</a></p>
      </form>`;
  }

  if (mode === 'forgot') {
    return html`
      <form class="card login-card" id="login" novalidate>
        <div class="login-badge">${icon('lock')}</div>
        <h1>Forgot your password?</h1>
        <p class="muted sub">${COPY.forgot}</p>
        <div id="forgot-body">
          ${emailField('username')}
          ${banner}
          ${submit('Send reset link')}
        </div>
        <p class="login-help"><a href="#" id="to-login">← Back to sign in</a></p>
      </form>`;
  }

  return html`
    <form class="card login-card" id="login" novalidate>
      ${roleTabs()}
      <h1>Welcome back</h1>
      <p class="muted sub" id="role-copy">${COPY.login[role]}</p>
      ${emailField('username')}
      ${passwordField({ id: 'password', label: 'Password', placeholder: 'Enter your password' })}
      <div class="row-between">
        <label class="check" for="remember"><input id="remember" name="remember" type="checkbox" ${role === 'resident' && 'checked'} /> <span>Remember me</span></label>
        <a href="#" id="to-forgot">Forgot password?</a>
      </div>
      <p class="lock-note" id="lock-note" role="status" aria-live="polite" hidden></p>
      ${banner}
      ${submit('Sign in')}
      <p class="login-help">${role === 'resident'
        ? html`<a href="#" id="to-register">No account yet? Create one</a>`
        : html`Staff and admin accounts are created by the barangay admin.`}</p>
    </form>`;
}

function draw() {
  clearInterval(countdown);
  render(
    app,
    authScreen({
      theme: 'login',
      headline: 'Report it. Track it. See it resolved.',
      blurb: mode === 'register' ? COPY.register : mode === 'forgot' ? COPY.forgot : COPY.login[role],
      points: [
        ['pin', 'Attach a photo and your location'],
        ['clock', 'Track the status of every report'],
        ['bell', 'Get notified when it is being fixed'],
      ],
      form: formMarkup(),
    })
  );
  wireAuthTheme();
  const form = document.getElementById('login');
  const banner = document.getElementById('banner');
  const button = form.querySelector('button[type=submit]');
  const label = button.querySelector('span');
  const original = label.textContent;

  const showError = (message) => {
    banner.textContent = message;
    banner.hidden = !message;
  };
  const busy = (text) => {
    button.disabled = true;
    button.classList.add('is-loading');
    label.textContent = text;
  };
  const idle = () => {
    button.disabled = false;
    button.classList.remove('is-loading');
    label.textContent = original;
  };
  const go = (next) => (e) => {
    e.preventDefault();
    notice = '';
    mode = next;
    history.replaceState(null, '', mode === 'register' ? '?mode=register' : location.pathname);
    draw();
  };
  document.getElementById('to-login')?.addEventListener('click', go('login'));
  document.getElementById('to-register')?.addEventListener('click', go('register'));
  document.getElementById('to-forgot')?.addEventListener('click', go('forgot'));

  if (mode === 'register') wireStrength(form.password, form.querySelector('.pw-meter'));
  if (mode === 'login') wireRoleTabs(form);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    notice = '';
    showError('');
    if (mode === 'login' && lockedSeconds()) return;
    if (!validateForm(form)) return;

    if (mode === 'forgot') return submitForgot(form, { busy, idle, showError });

    if (mode === 'register') {
      const weak = passwordProblem(form.password.value);
      if (weak) {
        setFieldError(form.password, weak);
        form.password.focus();
        return;
      }
      busy('Creating account…');
      try {
        await registerResident({ name: form.name.value, email: form.email.value, password: form.password.value });
        // onSession() takes it from here: the resident opens the area and is asked to verify their email.
      } catch (err) {
        showError(err.message);
        idle();
      }
      return;
    }

    busy('Signing in…');
    try {
      await login(form.email.value.trim(), form.password.value, { remember: form.remember.checked, role });
      resetFailures();
      // onSession() takes it from here: it opens the right area, or explains why this account cannot be used.
    } catch (err) {
      idle();
      let message = err.message;
      if (CREDENTIAL_CODES.includes(err.code)) {
        if (recordFailure()) {
          message = ''; // the countdown note under the fields says it
        } else if (attemptsLeft() <= 2) {
          message += ` ${attemptsLeft()} ${attemptsLeft() === 1 ? 'try' : 'tries'} left before a short pause.`;
        }
      }
      showError(message);
      form.password.value = '';
      form.password.focus();
      startLockCountdown(form, button);
    }
  });

  if (mode === 'login') startLockCountdown(form, button);
}

// Role tabs: click, or arrow keys. Changing the tab only changes the wording and defaults; it is the same form.
function wireRoleTabs(form) {
  const tabs = [...form.querySelectorAll('[role=tab]')];
  const choose = (key, focus) => {
    role = key;
    store.set(ROLE_KEY, key);
    notice = '';
    const typed = form.email.value;
    draw();
    document.getElementById('login').email.value = typed;
    if (focus) document.getElementById(`tab-${key}`).focus();
  };
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => choose(tab.dataset.role, false));
    tab.addEventListener('keydown', (e) => {
      const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!delta) return;
      e.preventDefault();
      choose(tabs[(i + delta + tabs.length) % tabs.length].dataset.role, true);
    });
  });
}

// While the lockout lasts every field is disabled and a countdown shows how long is left.
function startLockCountdown(form, button) {
  clearInterval(countdown);
  const note = document.getElementById('lock-note');
  const controls = [...form.querySelectorAll('input, button')].filter((c) => !c.closest('[role=tablist]'));
  const tick = () => {
    const left = lockedSeconds();
    controls.forEach((c) => { c.disabled = left > 0; });
    note.hidden = left === 0;
    if (left > 0) {
      note.textContent = `Too many failed attempts. You can try again in ${left} second${left === 1 ? '' : 's'}.`;
    } else {
      clearInterval(countdown);
      button.disabled = false;
    }
  };
  if (!lockedSeconds()) return;
  tick();
  countdown = setInterval(tick, 1000);
}

// "Forgot password": the message is the same whether or not the email has an account.
async function submitForgot(form, { busy, idle, showError }) {
  busy('Sending…');
  try {
    await sendPasswordReset(form.email.value);
  } catch (err) {
    idle();
    return showError(err.message);
  }
  const body = document.getElementById('forgot-body');
  render(body, html`<div class="form-ok" role="status">If an account exists for <strong>${form.email.value.trim()}</strong>, we have sent a link to choose a new password. Check your inbox, and the spam folder too.</div>`);
}

if (!isConfigured) {
  render(
    app,
    html`<div class="login-wrap"><div class="card login-card"><h1>Firebase is not set up yet</h1>
      <p>Paste your Firebase web config into <code>public/js/config.js</code>, or open this page with <code>?emulator</code>.</p></div></div>`
  );
} else {
  render(app, html`<div class="loading">Loading…</div>`);
  onSession((_profile, problem) => {
    // Only called while nobody is signed in (a signed-in user has already been sent to their area).
    if (problem) notice = problem;
    draw();
  });
}

import { consumeNotice, isConfigured, login, onSession, registerResident } from './firebase.js';
import { authScreen, html, icon, loginForm, render, wireLoginForm } from './ui.js';

// The one sign-in page for everybody. After signing in, onSession() sends each person to their own area
// (admin -> /admin/, staff -> /staff/, resident -> /resident/). Only residents can create an account here.
const app = document.getElementById('app');

let mode = new URLSearchParams(location.search).get('mode') === 'register' ? 'register' : 'login';
let notice = consumeNotice(); // e.g. why an area sent the user back here

function draw() {
  const signingUp = mode === 'register';
  render(
    app,
    authScreen({
      theme: 'login',
      headline: 'Report it. Track it. See it resolved.',
      blurb: signingUp
        ? 'Create a free resident account to send reports with a photo and location, and follow each one until it is fixed.'
        : 'Sign in to send a report with a photo and location, and follow it until it is fixed.',
      points: [
        ['pin', 'Attach a photo and your location'],
        ['clock', 'Track the status of every report'],
        ['bell', 'Get notified when it is being fixed'],
      ],
      form: loginForm({
        title: signingUp ? 'Create your account' : 'Welcome back',
        subtitle: signingUp ? 'Register as a resident' : 'Sign in to your account',
        submitLabel: signingUp ? 'Create account' : 'Sign in',
        notice,
        fields: signingUp
          ? html`<div class="field"><label>Full name</label>
              <div class="input-wrap">${icon('user')}<input name="name" autocomplete="name" placeholder="Juan Dela Cruz" required /></div></div>`
          : '',
        footer: html`<p class="login-help"><a href="#" id="toggle">
          ${signingUp ? 'Already have an account? Sign in' : 'No account yet? Create one'}</a></p>`,
      }),
    })
  );

  const form = document.getElementById('login');
  const ui = wireLoginForm(form);
  document.getElementById('toggle').onclick = (e) => {
    e.preventDefault();
    notice = '';
    mode = signingUp ? 'login' : 'register';
    history.replaceState(null, '', mode === 'register' ? '?mode=register' : location.pathname);
    draw();
  };
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    notice = '';
    ui.showError('');
    ui.busy(signingUp ? 'Creating account…' : 'Signing in…');
    try {
      if (signingUp) await registerResident({ name: form.name.value, email: form.email.value, password: form.password.value });
      else await login(form.email.value.trim(), form.password.value);
      // onSession() takes it from here: it opens the right area, or explains why this account cannot be used.
    } catch (err) {
      ui.showError(err.message);
      ui.idle();
    }
  });
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

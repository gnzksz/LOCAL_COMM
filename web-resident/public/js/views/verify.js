import { checkVerified, sendVerification } from '../firebase.js';
import { html, icon, render } from '../ui.js';

const COOLDOWN_SECONDS = 60;
const KEY = 'lcs_verify_until';

const until = () => {
  try { return Number(sessionStorage.getItem(KEY)) || 0; } catch { return 0; }
};
const setUntil = (ms) => {
  try { sessionStorage.setItem(KEY, String(ms)); } catch { /* private mode */ }
};

let openDialog = null;

/**
 * "Verify your email" as a modal over whatever page the resident is on. The confirmation email can be sent again
 * (with a pause) and the status refreshed. When the email is confirmed the modal says so and the app is told
 * through the "lcs:verified" event.
 */
export function openVerifyModal(user) {
  if (openDialog) return; // already open
  let verified = !!user.emailVerified;
  let timer = null;

  const dlg = document.createElement('dialog');
  dlg.className = 'dialog verify-modal';
  dlg.setAttribute('aria-labelledby', 'verify-title');
  document.body.append(dlg);
  openDialog = dlg;

  const close = () => dlg.close();
  dlg.addEventListener('close', () => {
    clearInterval(timer);
    dlg.remove();
    openDialog = null;
  });
  // a click on the dark area around the card closes it too
  dlg.addEventListener('click', (e) => e.target === dlg && close());

  function draw() {
    render(
      dlg,
      html`
        <button type="button" class="icon-btn verify-close" data-close aria-label="Close">${icon('x')}</button>
        ${verified
          ? html`<div class="sent-state">
              <div class="sent-icon">${icon('check')}</div>
              <h2 id="verify-title">Your email is verified</h2>
              <p class="muted">Thank you. You can now send reports.</p>
              <div class="verify-actions"><a class="btn btn-cta" href="#/new" data-close>Send a report</a></div>
            </div>`
          : html`
            <div class="verify-icon">${icon('mail')}</div>
            <h2 id="verify-title">Verify your email</h2>
            <p>We sent a confirmation link to <strong>${user.email}</strong>. Open the email, click the link, then come back here and press <strong>I have verified</strong>.</p>
            <p class="muted small">It can take a minute to arrive. Look in the spam or junk folder too. You can browse your reports, but sending a new report needs a verified email.</p>
            <p class="form-error" id="verify-error" role="alert" hidden></p>
            <p class="form-ok" id="verify-ok" role="status" hidden></p>
            <div class="verify-actions">
              <button type="button" class="btn btn-primary" id="check"><span>I have verified</span></button>
              <button type="button" class="btn" id="resend"><span>Resend email</span></button>
              <button type="button" class="link-btn" data-close>Later</button>
            </div>`}`
    );
    dlg.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', close));
    if (!verified) wire();
  }

  function wire() {
    const error = dlg.querySelector('#verify-error');
    const ok = dlg.querySelector('#verify-ok');
    const check = dlg.querySelector('#check');
    const resend = dlg.querySelector('#resend');
    const say = (type, message) => {
      error.hidden = type !== 'error';
      ok.hidden = type !== 'ok';
      (type === 'error' ? error : ok).textContent = message;
    };

    // The Resend button waits 60 seconds after each use, so the inbox is not flooded.
    const tick = () => {
      const left = Math.ceil((until() - Date.now()) / 1000);
      resend.disabled = left > 0;
      resend.querySelector('span').textContent = left > 0 ? `Resend email (${left}s)` : 'Resend email';
      if (left <= 0) clearInterval(timer);
    };
    clearInterval(timer);
    if (until() > Date.now()) timer = setInterval(tick, 1000);
    tick();

    resend.addEventListener('click', async () => {
      resend.disabled = true;
      say('', '');
      try {
        await sendVerification();
        setUntil(Date.now() + COOLDOWN_SECONDS * 1000);
        say('ok', `Email sent to ${user.email}. Check your inbox.`);
      } catch (err) {
        say('error', err.message);
      }
      clearInterval(timer);
      timer = setInterval(tick, 1000);
      tick();
    });

    check.addEventListener('click', async () => {
      check.disabled = true;
      check.classList.add('is-loading');
      say('', '');
      try {
        if (await checkVerified()) {
          verified = true;
          user.emailVerified = true;
          window.dispatchEvent(new CustomEvent('lcs:verified'));
          return draw();
        }
        say('error', 'We do not see the confirmation yet. Open the email, click the link, then press this button again.');
      } catch {
        say('error', 'Could not check right now. Please try again in a moment.');
      }
      check.disabled = false;
      check.classList.remove('is-loading');
    });
  }

  draw();
  dlg.showModal();
}

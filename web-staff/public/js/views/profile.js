// "My profile" for staff AND residents. This file is the master (web-staff); `npm run build:web` copies it to web-resident.
// Only the colours (theme) and the three numbers (watchProfileStats in each portal's service.js) differ per portal.
import { avatarFromFile, contactPatch, saveUser } from '../data.js';
import { auth, getProfile, refreshProfile, requestEmailChange } from '../firebase.js';
import { watchProfileStats } from '../service.js';
import { avatarMarkup, formatDate, html, icon, render, roleLabel, statCards, toast, updateSidebarIdentity } from '../ui.js';

// ---- Philippine mobile numbers: format while typing, and check ----------------------------------------------------
/** "09171234567" -> "0917 123 4567";  "+639171234567" -> "+63 917 123 4567" */
export function formatPhone(raw) {
  const text = String(raw || '').trim();
  const international = text.startsWith('+') || text.replace(/\D/g, '').startsWith('63');
  let digits = text.replace(/\D/g, '');
  if (international) {
    if (digits.startsWith('63')) digits = digits.slice(2);
    digits = digits.slice(0, 10);
    return digits ? `+63 ${[digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 10)].filter(Boolean).join(' ')}` : text.startsWith('+') ? '+' : '';
  }
  digits = digits.slice(0, 11);
  return [digits.slice(0, 4), digits.slice(4, 7), digits.slice(7, 11)].filter(Boolean).join(' ');
}
export function phoneProblem(value) {
  const compact = String(value).replace(/\s/g, '');
  return /^(09\d{9}|\+639\d{9})$/.test(compact) ? '' : 'Enter a mobile number like 0917 123 4567 or +63 917 123 4567.';
}

// ---- profile completeness ---------------------------------------------------------------------------------------------
const CHECKS = [
  ['name', 'full name', (p) => !!p.name?.trim()],
  ['phone', 'phone number', (p) => !!p.phone],
  ['address', 'address', (p) => !!p.address],
  ['photo', 'profile photo', (p) => !!p.photo],
];
function completeness(p) {
  const missing = CHECKS.filter(([, , has]) => !has(p)).map(([, label]) => label);
  const percent = Math.round(((CHECKS.length - missing.length) / CHECKS.length) * 100);
  const list = missing.length > 1 ? `${missing.slice(0, -1).join(', ')} and ${missing.at(-1)}` : missing[0];
  return { percent, hint: missing.length ? `Add your ${list} to reach 100%.` : 'Your profile is complete. Thank you!' };
}

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
function countUp(el) {
  const to = Number(el.textContent) || 0;
  if (!to || reducedMotion()) return;
  const start = performance.now();
  const tick = (now) => {
    const p = Math.min(1, (now - start) / 700);
    el.textContent = Math.round(to * (1 - (1 - p) ** 3));
    if (p < 1) requestAnimationFrame(tick);
  };
  el.textContent = '0';
  requestAnimationFrame(tick);
}

const fmt = (value) => (value ? formatDate(value) : '—');
// Firestore timestamps (last_login_at, previous_login_at) -> ISO text that formatDate() understands.
const iso = (t) => (t?.toDate ? t.toDate().toISOString() : null);

export function mount(el) {
  const me0 = getProfile();
  let saved = { name: me0.name || '', phone: me0.phone || '', address: me0.address || '' };

  render(
    el,
    html`
      <div class="profile-page">
        <section class="card profile-hero anim" id="hero"></section>
        <div id="stats" class="anim" style="--d:80ms"></div>

        <div class="profile-grid">
          <form class="card anim" id="form" style="--d:140ms" novalidate>
            <h2 class="section-title">${icon('user')}Personal information</h2>
            <div class="field"><label for="p-name">Full name</label>
              <div class="input-wrap">${icon('user')}<input id="p-name" name="name" autocomplete="name" maxlength="100" required /></div>
              <small class="field-error" id="name-err" hidden></small></div>
            <div class="field"><label for="p-phone">Phone number</label>
              <div class="input-wrap">${icon('phone')}<input id="p-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" maxlength="17" placeholder="0917 123 4567" /></div>
              <small class="field-error" id="phone-err" hidden></small></div>
            <div class="field"><label for="p-address">Address</label>
              <div class="input-wrap">${icon('pin')}<input id="p-address" name="address" autocomplete="street-address" maxlength="200" placeholder="Purok / street / barangay" /></div></div>
            <p class="form-error" hidden></p>
            <div class="form-actions">
              <button type="button" class="link-btn" id="reset" hidden>Reset changes</button>
              <button class="btn btn-primary" type="submit" id="save" disabled>
                <span>Save changes</span>
                <svg class="check-anim" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>
              </button>
            </div>
          </form>

          <div class="stack">
            <form class="card anim" id="email-form" style="--d:200ms">
              <h2 class="section-title">${icon('shield')}Account &amp; security</h2>
              <div class="email-body">
                <p class="muted small">This is the email you sign in with. To change it, enter the new email and your password.
                  We send a confirmation link to the new address, and you keep signing in with the old one until you open it.</p>
                <div class="field"><label>Current email</label>
                  <div class="input-wrap readonly">${icon('mail')}<input value="${me0.email}" readonly tabindex="-1" aria-readonly="true" />${icon('lock')}</div></div>
                <div class="field"><label for="p-new-email">New email</label>
                  <div class="input-wrap">${icon('mail')}<input id="p-new-email" name="new_email" type="email" autocomplete="off" required /></div></div>
                <div class="field"><label for="p-pass">Your password</label>
                  <div class="input-wrap">${icon('lock')}<input id="p-pass" name="password" type="password" autocomplete="current-password" required />
                    <button type="button" class="pw-toggle" data-toggle-pw aria-label="Show password">${icon('eye')}</button></div></div>
                <p class="form-error" hidden></p>
                <div class="form-actions"><button class="btn" type="submit"><span>Send confirmation link</span></button></div>
              </div>
              <div class="sent-state" hidden>
                <div class="sent-icon">${icon('mail')}</div>
                <h3>Check your new email inbox</h3>
                <p class="muted" id="sent-text"></p>
                <button type="button" class="link-btn" id="again">Use a different email</button>
              </div>
            </form>

            <section class="card anim info-card" style="--d:260ms">
              <h2 class="section-title">${icon('clock')}Account activity</h2>
              <dl class="kv">
                <dt>Account created</dt><dd>${fmt(auth.currentUser?.metadata?.creationTime || me0.created_at)}</dd>
                <dt>Last signed in</dt><dd>${iso(me0.previous_login_at) ? fmt(iso(me0.previous_login_at)) : 'This is your first sign-in'}</dd>
                <dt>This session started</dt><dd>${fmt(iso(me0.last_login_at) || auth.currentUser?.metadata?.lastSignInTime)}</dd>
              </dl>
            </section>
          </div>
        </div>
      </div>`
  );

  const heroEl = el.querySelector('#hero');
  const statsEl = el.querySelector('#stats');
  const form = el.querySelector('#form');
  const save = el.querySelector('#save');
  const reset = el.querySelector('#reset');
  const formError = form.querySelector('.form-error');
  const phoneErr = el.querySelector('#phone-err');
  const nameErr = el.querySelector('#name-err');

  // ---- header: banner, avatar (with upload), name, badges, completeness -----------------------------------------------------------------
  function drawHero() {
    const p = getProfile();
    const { percent, hint } = completeness(p);
    render(
      heroEl,
      html`
        <div class="hero-body">
          <div class="avatar-wrap">
            <div class="avatar-lg">${avatarMarkup(p)}</div>
            <button type="button" class="avatar-cam" id="avatar-btn" title="Change photo" aria-label="Change profile photo">${icon('camera')}</button>
            <input class="sr-only" id="avatar-input" type="file" accept="image/*" tabindex="-1" />
          </div>
          <div class="hero-text">
            <h1>${p.name}</h1>
            <div class="hero-email">${p.email}</div>
            <div class="tags"><span class="tag tag-role">${roleLabel(p.role)}</span>${p.department_name && html`<span class="tag tag-dept">${p.department_name}</span>`}
              ${p.photo && html`<button type="button" class="link-btn" id="avatar-remove">Remove photo</button>`}</div>
          </div>
          <div class="complete ${percent === 100 ? 'done' : ''}">
            <div class="complete-head"><strong>Profile completeness</strong><span>${percent}%</span></div>
            <div class="meter" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}"><i style="width:${percent}%"></i></div>
            <div class="complete-hint">${percent === 100 ? icon('check') : ''}${hint}</div>
          </div>
        </div>`
    );
  }
  drawHero();

  heroEl.addEventListener('click', async (e) => {
    if (e.target.closest('#avatar-btn')) return heroEl.querySelector('#avatar-input').click();
    if (e.target.closest('#avatar-remove')) {
      try {
        await saveUser(getProfile().id, { photo: null });
        updateSidebarIdentity(await refreshProfile());
        drawHero();
        toast('Photo removed', 'success');
      } catch (err) {
        toast(err.message, 'error');
      }
    }
  });
  heroEl.addEventListener('change', async (e) => {
    if (e.target.id !== 'avatar-input' || !e.target.files[0]) return;
    try {
      const photo = await avatarFromFile(e.target.files[0]);
      await saveUser(getProfile().id, { photo });
      updateSidebarIdentity(await refreshProfile());
      drawHero();
      toast('Photo updated', 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  // ---- the three numbers (live, counted up the first time) ---------------------------------------------------------------------------------
  let firstStats = true;
  const stopStats = watchProfileStats(me0.id, (stats) => {
    render(statsEl, statCards(stats));
    if (firstStats) {
      firstStats = false;
      statsEl.querySelectorAll('.value').forEach(countUp);
    }
  });

  // ---- personal information: validation, auto-format, save states ---------------------------------------------------------------------------------
  const fields = () => ({ name: form.name.value.trim(), phone: form.phone.value.trim(), address: form.address.value.trim() });
  function fillForm(values) {
    form.name.value = values.name;
    form.phone.value = values.phone ? formatPhone(values.phone) : '';
    form.address.value = values.address;
  }
  function refreshState() {
    const v = fields();
    const nameProblem = v.name ? '' : 'Your name is required.';
    const phoneProblemText = v.phone ? phoneProblem(v.phone) : '';
    nameErr.textContent = nameProblem;
    nameErr.hidden = !nameProblem;
    phoneErr.textContent = phoneProblemText;
    phoneErr.hidden = !phoneProblemText;
    const dirty = v.name !== saved.name || v.phone !== (saved.phone ? formatPhone(saved.phone) : '') || v.address !== saved.address;
    save.disabled = !dirty || !!nameProblem || !!phoneProblemText;
    reset.hidden = !dirty;
  }
  fillForm(saved);
  refreshState();

  form.phone.addEventListener('input', () => {
    form.phone.value = formatPhone(form.phone.value);
    refreshState();
  });
  form.name.addEventListener('input', refreshState);
  form.address.addEventListener('input', refreshState);
  reset.addEventListener('click', () => {
    fillForm(saved);
    formError.hidden = true;
    refreshState();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (save.disabled) return;
    formError.hidden = true;
    save.disabled = true;
    save.classList.add('is-loading');
    try {
      const v = fields();
      await saveUser(getProfile().id, contactPatch(v));
      const fresh = await refreshProfile();
      saved = { name: fresh.name || '', phone: fresh.phone || '', address: fresh.address || '' };
      updateSidebarIdentity(fresh);
      drawHero();
      fillForm(saved);
      save.classList.remove('is-loading');
      save.classList.add('saved');
      setTimeout(() => save.classList.remove('saved'), 1800);
      toast('Profile updated', 'success');
    } catch (err) {
      save.classList.remove('is-loading');
      formError.textContent = err.message;
      formError.hidden = false;
    }
    refreshState();
  });

  // ---- login email: confirmation link flow ----------------------------------------------------------------------------------------------------
  const emailForm = el.querySelector('#email-form');
  const emailBody = emailForm.querySelector('.email-body');
  const sent = emailForm.querySelector('.sent-state');
  const emailError = emailBody.querySelector('.form-error');
  const pass = emailForm.querySelector('#p-pass');
  const toggle = emailForm.querySelector('[data-toggle-pw]');
  toggle.addEventListener('click', () => {
    const show = pass.type === 'password';
    pass.type = show ? 'text' : 'password';
    toggle.innerHTML = String(icon(show ? 'eye-off' : 'eye'));
    toggle.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  });
  emailForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    emailError.hidden = true;
    const button = emailBody.querySelector('[type=submit]');
    button.disabled = true;
    button.classList.add('is-loading');
    try {
      const sentTo = await requestEmailChange(emailForm.new_email.value, pass.value);
      emailForm.querySelector('#sent-text').textContent =
        `We sent a confirmation link to ${sentTo}. Open it (check Spam too) to finish. Until then you still sign in with ${getProfile().email}.`;
      emailBody.hidden = true;
      sent.hidden = false;
      pass.value = '';
    } catch (err) {
      emailError.textContent = err.message;
      emailError.hidden = false;
    } finally {
      button.disabled = false;
      button.classList.remove('is-loading');
    }
  });
  emailForm.querySelector('#again').addEventListener('click', () => {
    sent.hidden = true;
    emailBody.hidden = false;
    emailForm.new_email.value = '';
  });

  return { destroy: stopStats };
}

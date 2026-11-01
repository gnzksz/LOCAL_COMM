// Small UI helpers shared by the views.

class Raw {
  constructor(value) {
    this.value = value;
  }
  toString() {
    return this.value;
  }
}

/** Mark a string as already-safe HTML so `html` will not escape it. */
export const raw = (value) => new Raw(value);

export const esc = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );

function interpolate(value) {
  if (value instanceof Raw) return value.value;
  if (Array.isArray(value)) return value.map(interpolate).join('');
  if (value == null || value === false) return '';
  return esc(value);
}

/**
 * Tagged template that escapes every interpolated value (protects against
 * HTML injection from user-submitted text). Nest `html` results freely.
 */
export function html(strings, ...values) {
  return raw(strings.reduce((out, s, i) => out + s + (i < values.length ? interpolate(values[i]) : ''), ''));
}

export function render(el, template) {
  el.innerHTML = String(template);
}

// Dates arrive as ISO strings (see data.js).
export const parseDate = (s) => (s ? new Date(s) : null);

/** Short, readable reference for a Firestore document id. */
export const shortId = (id) => String(id).slice(0, 6).toUpperCase();

export function formatDate(s) {
  const d = parseDate(s);
  return d
    ? d.toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
    : '—';
}

export function timeAgo(s) {
  const d = parseDate(s);
  if (!d) return '—';
  const sec = Math.round((Date.now() - d) / 1000);
  if (sec < 60) return 'just now';
  const units = [
    [60, 'minute'],
    [24, 'hour'],
    [7, 'day'],
    [4.35, 'week'],
    [12, 'month'],
    [Infinity, 'year'],
  ];
  let n = sec / 60;
  for (const [size, unit] of units) {
    if (n < size) return `${Math.floor(n)} ${unit}${Math.floor(n) === 1 ? '' : 's'} ago`;
    n /= size;
  }
}

export const statusBadge = (status) =>
  html`<span class="badge badge-${status.toLowerCase().replace(/\s+/g, '-')}">${status}</span>`;

export const stars = (rating) =>
  rating ? html`<span class="stars" title="${rating} out of 5">${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}</span>` : '';

export function mapEmbed(lat, lng) {
  const d = 0.003;
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - d},${lat - d},${lng + d},${lat + d}&layer=mapnik&marker=${lat},${lng}`;
  return html`
    <div class="map">
      <iframe src="${src}" loading="lazy" title="Report location"></iframe>
      <a class="map-link" href="https://www.google.com/maps?q=${lat},${lng}" target="_blank" rel="noopener">
        Open in Google Maps ↗
      </a>
    </div>`;
}

export function timeline(history) {
  return html`
    <ol class="timeline">
      ${history.map(
        (h) => html`
          <li>
            <div class="timeline-head">${statusBadge(h.status)}<time>${formatDate(h.created_at)}</time></div>
            ${h.actor_name && html`<div class="muted small">by ${h.actor_name} (${h.actor_role})</div>`}
            ${h.note && html`<p>${h.note}</p>`}
          </li>`
      )}
    </ol>`;
}

export function toast(message, type = 'info') {
  let box = document.querySelector('.toasts');
  if (!box) {
    box = document.createElement('div');
    box.className = 'toasts';
    document.body.append(box);
  }
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = message;
  box.append(el);
  setTimeout(() => el.remove(), 4500);
}

/**
 * Modal form dialog. `onSubmit(values)` may throw to show an error and keep the dialog open.
 * `onOpen(form)` lets the caller wire up extra behaviour (e.g. dependent selects).
 */
export function openDialog({ title, content, submitLabel = 'Save', danger = false, onSubmit, onOpen }) {
  const dlg = document.createElement('dialog');
  dlg.className = 'dialog';
  render(
    dlg,
    html`
      <form>
        <h2>${title}</h2>
        <div class="dialog-body">${content}</div>
        <p class="form-error" hidden></p>
        <div class="dialog-actions">
          <button type="button" class="btn btn-ghost" data-cancel>Cancel</button>
          <button type="submit" class="btn ${danger ? 'btn-danger' : 'btn-primary'}">${submitLabel}</button>
        </div>
      </form>`
  );
  document.body.append(dlg);
  const form = dlg.querySelector('form');
  const error = dlg.querySelector('.form-error');
  dlg.querySelector('[data-cancel]').onclick = () => dlg.close();
  dlg.addEventListener('close', () => dlg.remove());
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const button = form.querySelector('[type=submit]');
    button.disabled = true;
    error.hidden = true;
    try {
      await onSubmit(Object.fromEntries(new FormData(form)));
      dlg.close();
    } catch (err) {
      error.textContent = err.message;
      error.hidden = false;
    } finally {
      button.disabled = false;
    }
  });
  onOpen?.(form);
  dlg.showModal();
}

export const loading = () => html`<div class="loading">Loading…</div>`;

export const errorState = (err) => html`<div class="empty error">${err.message}</div>`;

// ---- Layout helpers (icons, stat cards, sign-in screen) ---------------------------------------------

const ICONS = {
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M21 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  tool: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  clipboard: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>',
  pin: '<path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  'eye-off': '<path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.5 6.6A17 17 0 0 0 2 12s3.6 7 10 7a9.7 9.7 0 0 0 4.2-.9M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  shield: '<path d="M12 3 4 6v6c0 4.5 3.2 8.2 8 9 4.8-.8 8-4.5 8-9V6l-8-3z"/><path d="m9 12 2 2 4-4"/>',
};

export const icon = (name) => raw(`<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`);

export const initials = (name = '') =>
  String(name).split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';

/** Row of summary cards. items: [{ label, value, tone: blue|amber|violet|green|red, icon }] */
export function statCards(items) {
  return html`<div class="stat-grid">${items.map(
    (s) => html`<div class="card stat tone-${s.tone || 'blue'}">
      <div class="stat-icon">${icon(s.icon || 'list')}</div>
      <div><div class="value">${s.value}</div><div class="muted">${s.label}</div></div></div>`
  )}</div>`;
}

/** Sidebar footer: avatar, name, role and a sign-out button. */
export function sidebarFooter(profile) {
  return html`<div class="sidebar-footer">
    <div class="avatar">${initials(profile.name)}</div>
    <div class="who"><strong>${profile.name}</strong><span>${profile.role}</span></div>
    <button class="icon-btn" id="logout" title="Sign out" aria-label="Sign out">${icon('logout')}</button>
  </div>`;
}

export const brandBlock = (subtitle) =>
  html`<div class="brand"><div class="logo">LC</div><div>LOCAL_COMM<small>${subtitle}</small></div></div>`;

/** A sample report card shown on the sign-in screens (purely decorative). */
export const reportPreview = () => html`
  <div class="mock" aria-hidden="true">
    <div class="mock-head">
      <div class="mock-thumb">${icon('pin')}</div>
      <div><strong>Streetlight not working</strong><div class="muted small">Purok 3 · reported 5 min ago</div></div>
      <span class="badge badge-in-progress">In Progress</span>
    </div>
    <div class="mock-steps">
      <span class="done"><i></i>Pending</span><span class="done"><i></i>Assigned</span>
      <span class="now"><i></i>In Progress</span><span><i></i>Resolved</span>
    </div>
  </div>`;

/** Split sign-in screen: brand panel on the left, the form on the right. theme = admin | staff | resident */
export function authScreen({ theme = 'admin', headline, blurb, points, form }) {
  return html`
    <div class="auth auth-${theme}">
      <section class="auth-brand">
        <div class="blob b1"></div><div class="blob b2"></div>
        <svg class="skyline" viewBox="0 0 600 140" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
          <g fill="currentColor">
            <rect x="10" y="70" width="46" height="70"/><rect x="62" y="40" width="40" height="100"/><rect x="108" y="86" width="52" height="54"/>
            <rect x="168" y="24" width="44" height="116"/><rect x="218" y="64" width="38" height="76"/><rect x="262" y="94" width="56" height="46"/>
            <rect x="326" y="48" width="42" height="92"/><rect x="374" y="76" width="50" height="64"/><rect x="430" y="30" width="40" height="110"/>
            <rect x="478" y="66" width="52" height="74"/><rect x="536" y="90" width="54" height="50"/>
          </g>
        </svg>
        <div class="auth-brand-inner">
          ${brandBlock('Community service requests')}
          <div class="auth-copy"><h2>${headline}</h2><p>${blurb}</p></div>
          ${reportPreview()}
          <ul class="auth-points">${points.map(([ic, text]) => html`<li>${icon(ic)}<span>${text}</span></li>`)}</ul>
        </div>
      </section>
      <section class="auth-panel">
        <div class="auth-mobile-brand">${brandBlock('Community service requests')}</div>
        ${form}
        <p class="auth-foot">© LOCAL_COMM · Barangay service requests</p>
      </section>
    </div>`;
}

/**
 * The sign-in card. `fields` are extra inputs shown above the email (e.g. a name for sign-up);
 * `footer` is shown under the button.
 */
export function loginForm({ title, subtitle, notice = '', submitLabel = 'Sign in', fields = '', footer = '' }) {
  return html`
    <form class="card login-card" id="login">
      <div class="login-badge">${icon('shield')}</div>
      <h1>${title}</h1>
      <p class="muted sub">${subtitle}</p>
      ${fields}
      <div class="field"><label for="id">Email</label>
        <div class="input-wrap">${icon('mail')}<input id="id" name="email" type="email" autocomplete="username" placeholder="you@example.com" required autofocus /></div></div>
      <div class="field"><label for="pw">Password</label>
        <div class="input-wrap">${icon('lock')}<input id="pw" name="password" type="password" autocomplete="current-password" placeholder="Enter your password" required />
          <button type="button" class="pw-toggle" data-toggle-pw aria-label="Show password">${icon('eye')}</button></div></div>
      <p class="form-error" ${notice ? '' : 'hidden'}>${notice}</p>
      <button class="btn btn-primary btn-lg" type="submit"><span>${submitLabel}</span></button>
      ${footer}
    </form>`;
}

/** Hooks up the show/hide password button and gives helpers to show errors and a busy state. */
export function wireLoginForm(form) {
  const pw = form.querySelector('#pw');
  const toggle = form.querySelector('[data-toggle-pw]');
  toggle.addEventListener('click', () => {
    const show = pw.type === 'password';
    pw.type = show ? 'text' : 'password';
    toggle.innerHTML = String(icon(show ? 'eye-off' : 'eye'));
    toggle.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  });
  const error = form.querySelector('.form-error');
  const button = form.querySelector('button[type=submit]');
  const label = button.querySelector('span');
  const original = label.textContent;
  return {
    showError(message) {
      error.textContent = message;
      error.hidden = !message;
    },
    busy(text) {
      button.disabled = true;
      button.classList.add('is-loading');
      label.textContent = text;
    },
    idle() {
      button.disabled = false;
      button.classList.remove('is-loading');
      label.textContent = original;
    },
  };
}

/** Name / phone / address inputs, pre-filled from a user (used by the edit dialogs and the profile page). */
export const contactFields = (u = {}) => html`
  <div class="field"><label>Full name</label><input name="name" value="${u.name || ''}" maxlength="100" required /></div>
  <div class="field"><label>Phone number</label><input name="phone" type="tel" value="${u.phone || ''}" maxlength="30" placeholder="e.g. 0917 123 4567" /></div>
  <div class="field"><label>Address</label><input name="address" value="${u.address || ''}" maxlength="200" placeholder="Purok / street / barangay" /></div>`;

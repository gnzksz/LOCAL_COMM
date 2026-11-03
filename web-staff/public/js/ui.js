import { HOME_URL } from './config.js';
import { PASSWORD_RULES, SCORE_LABELS, passwordScore } from './password.js';
// Small UI helpers shared by the views.

// The brand mark: the Caloocan seal when assets/caloocan-seal.png exists, otherwise a navy square with an orange ring.
// (Drop the seal into web-shared/assets/; `npm run build:web` copies it to every site.)
const SEAL = '<span class="logo"><img src="assets/caloocan-seal.png" alt="" onload="this.parentNode.classList.add(\'has-seal\')" onerror="this.remove()" /><b>LCS</b></span>';

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
  // Accessibility defaults for every table drawn: header cells name their column, and a clickable row
  // can be reached and opened with the keyboard (see the Enter/Space handler at the bottom of this file).
  el.querySelectorAll('th:not([scope])').forEach((th) => th.setAttribute('scope', 'col'));
  el.querySelectorAll('tr.clickable:not([tabindex])').forEach((tr) => tr.setAttribute('tabindex', '0'));
  el.querySelectorAll('img[data-zoom]:not([tabindex])').forEach((img) => {
    img.setAttribute('tabindex', '0');
    img.setAttribute('role', 'button');
    img.setAttribute('aria-label', 'Enlarge photo');
  });
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
    box.setAttribute('aria-live', 'polite');
    document.body.append(box);
  }
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');
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
  dlg.setAttribute('aria-labelledby', 'dialog-title');
  render(
    dlg,
    html`
      <form novalidate>
        <h2 id="dialog-title">${title}</h2>
        <div class="dialog-body">${content}</div>
        <p class="form-error" hidden></p>
        <div class="dialog-actions">
          <button type="button" class="btn btn-ghost" data-cancel>Cancel</button>
          <button type="submit" class="btn ${danger ? 'btn-danger' : 'btn-primary'}">${submitLabel}</button>
        </div>
      </form>`
  );
  document.body.append(dlg);
  enhancePasswordFields(dlg);
  const form = dlg.querySelector('form');
  const error = dlg.querySelector('.form-error');
  dlg.querySelector('[data-cancel]').onclick = () => dlg.close();
  dlg.addEventListener('close', () => dlg.remove());
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validateForm(form)) return;
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

// ---- Loading placeholders: grey shapes that look like the content that is coming ----------------------

const bar = (w, h = 12) => `<span class="sk" style="width:${w};height:${h}px"></span>`;

/** kind: 'rows' (table rows, the default), 'cards' (a grid of cards) or 'page' (a detail page). */
export function loading(kind = 'rows') {
  let body;
  if (kind === 'cards') {
    body = `<div class="sk-grid">${Array.from({ length: 4 }, () => `<div class="sk-card">${bar('40%')}${bar('80%', 22)}${bar('60%')}</div>`).join('')}</div>`;
  } else if (kind === 'page') {
    body = `<div class="sk-page"><div>${bar('34%', 26)}${bar('22%')}</div>
      <div class="sk-detail"><div class="sk-card sk-tall">${bar('100%', 220)}${bar('30%', 16)}${bar('90%')}${bar('75%')}</div>
      <div class="sk-card sk-tall">${bar('100%', 160)}${bar('50%', 16)}${bar('85%')}</div></div></div>`;
  } else {
    body = Array.from({ length: 5 }, () => `<div class="sk-row">${bar('48px', 48)}<div class="sk-lines">${bar('38%', 14)}${bar('72%')}</div>${bar('84px', 22)}</div>`).join('');
  }
  return raw(`<div class="skeleton" role="status" aria-busy="true"><span class="sr-only">Loading…</span>${body}</div>`);
}

/** Grey stat cards, shown where statCards() will appear. */
export const skeletonStats = () =>
  raw(`<div class="stat-grid" aria-hidden="true">${Array.from({ length: 4 }, () => `<div class="card stat"><span class="sk" style="width:46px;height:46px;border-radius:12px"></span><div class="sk-lines">${bar('60px', 24)}${bar('90px')}</div></div>`).join('')}</div>`);

export const errorState = (err) => html`<div class="empty error" role="alert">${err.message}</div>`;

/**
 * Friendly empty state: an illustration (icon), a title, one line of help and an optional button.
 * action: { label, href } renders a link button, { label, id } renders a button with that id.
 */
export const emptyState = ({ icon: name = 'inbox', title, text = '', action = null }) => html`
  <div class="empty-state">
    <div class="empty-art" aria-hidden="true"><span class="ring r1"></span><span class="ring r2"></span>${icon(name)}</div>
    <h3>${title}</h3>
    ${text && html`<p class="muted">${text}</p>`}
    ${action && (action.href
      ? html`<a class="btn ${action.cta ? 'btn-cta' : 'btn-primary'}" href="${action.href}">${action.label}</a>`
      : html`<button type="button" class="btn btn-primary" id="${action.id}">${action.label}</button>`)}
  </div>`;

// ---- Status stepper (resident report page) ----------------------------------------------------------

const STEPS = ['Submitted', 'Assigned', 'In progress', 'Resolved'];
const STEP_OF = { Pending: 0, Assigned: 1, 'In Progress': 2, Resolved: 3, Archived: 3 };

/** Submitted -> Assigned -> In progress -> Resolved. A rejected report stops after Submitted. */
export function stepper(status) {
  const steps = status === 'Rejected' ? ['Submitted', 'Rejected'] : STEPS;
  const at = status === 'Rejected' ? 1 : STEP_OF[status] ?? 0;
  const finished = status === 'Resolved' || status === 'Archived';
  return html`
    <ol class="stepper ${status === 'Rejected' && 'is-rejected'}" aria-label="Progress of this report">
      ${steps.map((label, i) => {
        const state = i < at || (finished && i === at) ? 'done' : i === at ? 'current' : 'todo';
        return html`<li class="step ${state}" ${state === 'current' ? raw('aria-current="step"') : ''}>
          <span class="step-dot">${state === 'done' ? icon('check') : status === 'Rejected' && i === 1 ? icon('x') : i + 1}</span>
          <span class="step-label">${label}</span></li>`;
      })}
    </ol>`;
}

/** items: [[label, href], ..., [currentLabel]] */
export const breadcrumbs = (items) => html`
  <nav aria-label="Breadcrumb"><ol class="crumbs">
    ${items.map(([label, href], i) =>
      i === items.length - 1 || !href
        ? html`<li aria-current="page">${label}</li>`
        : html`<li><a href="${href}">${label}</a></li>`
    )}
  </ol></nav>`;

// ---- Inline form validation: a red border and a message under the field, not just a toast ---------------

const FIELD_MESSAGES = {
  valueMissing: () => 'This field is required.',
  typeMismatch: (el) => (el.type === 'email' ? 'Enter a valid email address, like name@example.com.' : 'Enter a valid value.'),
  tooShort: (el) => `Use at least ${el.minLength} characters.`,
  tooLong: (el) => `Use at most ${el.maxLength} characters.`,
  rangeUnderflow: (el) => `Must be ${el.min} or more.`,
  rangeOverflow: (el) => `Must be ${el.max} or less.`,
  badInput: () => 'Enter a valid number.',
};

const fieldHome = (el) => el.closest('.input-wrap') || el;

export function clearFieldError(el) {
  el.removeAttribute('aria-invalid');
  el.removeAttribute('aria-describedby');
  const home = fieldHome(el);
  for (const sibling of [home.nextElementSibling, home.nextElementSibling?.nextElementSibling]) {
    if (sibling?.classList.contains('field-error')) sibling.remove();
  }
  el._errorEl?.remove();
  el._errorEl = null;
}

/** Show `message` under `el` (or under `anchor` when the input itself is hidden, like a file input). */
export function setFieldError(el, message, anchor = fieldHome(el)) {
  clearFieldError(el);
  const note = document.createElement('span');
  note.className = 'field-error';
  note.id = `err-${Math.random().toString(36).slice(2, 8)}`;
  note.textContent = message;
  anchor.after(note);
  el._errorEl = note;
  el.setAttribute('aria-invalid', 'true');
  el.setAttribute('aria-describedby', note.id);
}

/** Checks every field of `form`; shows a message under each bad one and focuses the first. Returns true when all are fine. */
export function validateForm(form) {
  if (!form.dataset.inline) {
    form.dataset.inline = '1';
    form.noValidate = true;
    const clear = (e) => e.target.hasAttribute?.('aria-invalid') && clearFieldError(e.target);
    form.addEventListener('input', clear);
    form.addEventListener('change', clear);
  }
  let first = null;
  for (const el of form.elements) {
    if (!el.willValidate || el.type === 'file') continue;
    clearFieldError(el);
    if (el.checkValidity()) continue;
    const key = Object.keys(FIELD_MESSAGES).find((k) => el.validity[k]);
    setFieldError(el, key ? FIELD_MESSAGES[key](el) : el.validationMessage);
    first ??= el;
  }
  first?.focus();
  return !first;
}

// ---- Photo lightbox: click any photo marked data-zoom to see it large ------------------------------------

function openLightbox(src, alt) {
  const dlg = document.createElement('dialog');
  dlg.className = 'lightbox';
  dlg.setAttribute('aria-label', 'Photo');
  render(dlg, html`<button type="button" class="icon-btn lightbox-close" aria-label="Close photo">${icon('x')}</button>
    <img src="${src}" alt="${alt}" />`);
  document.body.append(dlg);
  dlg.addEventListener('click', () => dlg.close()); // a click anywhere closes it (Esc works too)
  dlg.addEventListener('close', () => dlg.remove());
  dlg.showModal();
}

// Capture phase, so clicking a thumbnail inside a clickable table row enlarges the photo instead of opening the row.
document.addEventListener(
  'click',
  (e) => {
    const img = e.target.closest?.('img[data-zoom]');
    if (!img) return;
    e.stopPropagation();
    e.preventDefault();
    openLightbox(img.currentSrc || img.src, img.alt || 'Photo');
  },
  true
);

// Keyboard: Enter or Space on a focused table row opens it, on a zoomable photo enlarges it.
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const t = e.target;
  if (t.matches?.('tr.clickable') || t.matches?.('img[data-zoom]')) {
    e.preventDefault();
    t.click();
  }
});

// ---- Light / dark theme -----------------------------------------------------------------------------------

const THEME_KEY = 'lcs-theme';

export function currentTheme() {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

export function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* private mode: the choice just is not remembered */
  }
}

/** One pace and one direction for every dark mode button on the site (the landing page uses the same numbers). */
export const THEME_MOTION_MS = 850;

/**
 * Switch light <-> dark with motion: the new theme spreads from the top-right corner of the screen, to the left and
 * down (the same on the landing page, the sign-in page and every dashboard), where the browser supports View
 * Transitions; otherwise the colours fade over. `after` repaints the button. No motion with reduced motion.
 */
export function toggleThemeWithMotion(origin, after = () => {}, { duration = THEME_MOTION_MS } = {}) {
  const flip = () => {
    setTheme(currentTheme() === 'dark' ? 'light' : 'dark');
    after();
  };
  const root = document.documentElement;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return flip();
  if (document.startViewTransition) {
    const x = innerWidth; // top-right corner
    const y = 0;
    const r = Math.hypot(innerWidth, innerHeight);
    const t = document.startViewTransition(flip);
    t.ready.then(() => root.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
      { duration, easing: 'cubic-bezier(.45, 0, .25, 1)', pseudoElement: '::view-transition-new(root)' }
    )).catch(() => {});
    return;
  }
  root.classList.add('theme-fading');
  flip();
  setTimeout(() => root.classList.remove('theme-fading'), duration);
}

// The saved choice wins; otherwise follow the device. (index.html applies the same rule before the first paint.)
if (!document.documentElement.dataset.theme) {
  let saved = null;
  try {
    saved = localStorage.getItem(THEME_KEY);
  } catch {
    /* ignore */
  }
  document.documentElement.dataset.theme = saved || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}

// ---- Layout helpers (icons, stat cards, sign-in screen) ---------------------------------------------

const ICONS = {
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M21 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>',
  tool: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  clipboard: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>',
  pin: '<path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  camera: '<path d="M3 8a2 2 0 0 1 2-2h2l1.5-2h7L17 6h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="3.5"/>',
  phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  'eye-off': '<path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.5 6.6A17 17 0 0 0 2 12s3.6 7 10 7a9.7 9.7 0 0 0 4.2-.9M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  shield: '<path d="M12 3 4 6v6c0 4.5 3.2 8.2 8 9 4.8-.8 8-4.5 8-9V6l-8-3z"/><path d="m9 12 2 2 4-4"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.7 4H7.3a2 2 0 0 0-1.8 1.1z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>',
  download: '<path d="M12 4v12M7 11l5 5 5-5M4 20h16"/>',
  printer: '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="9" rx="2"/><path d="M7 14h10v7H7z"/>',
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

const ROLE_LABELS = { admin: 'Admin', staff: 'Staff', resident: 'Resident' };

/** "admin" -> "Admin", "staff" -> "Staff", "resident" -> "Resident". */
export const roleLabel = (role) => ROLE_LABELS[role] || String(role || '');

/** The picture of a user, or their initials when they have none. */
export const avatarMarkup = (profile) =>
  profile.photo ? html`<img src="${profile.photo}" alt="" />` : initials(profile.name);

/** Refresh the name and picture shown in the sidebar footer (after the user edits their profile). */
export function updateSidebarIdentity(profile) {
  const name = document.querySelector('.sidebar .who strong');
  const avatar = document.querySelector('.sidebar .avatar');
  if (name) name.textContent = profile.name;
  if (avatar) render(avatar, avatarMarkup(profile));
}

/** "Last signed in: ..." for the tooltip of the sidebar footer (the admin has no profile page to show it on). */
const lastSignedIn = (profile) => {
  const before = profile.previous_login_at?.toDate?.();
  return before ? `Last signed in: ${formatDate(before.toISOString())}` : "";
};

/**
 * "My profile" in the menu, shown as the person: picture (or initials), name and role.
 * Uses the same .avatar / .who classes as before, so updateSidebarIdentity() keeps it current after an edit.
 */
export const profileNavLink = (profile, href = '#/profile') => {
  const inner = html`<span class="avatar">${avatarMarkup(profile)}</span>
    <span class="who"><strong>${profile.name}</strong><span>${roleLabel(profile.role)}</span></span>`;
  // href null: a portal without a profile page (admin) still shows who is signed in, but it is not a link.
  return href
    ? html`<a class="nav-link nav-profile" data-nav="profile" href="${href}" title="My profile">${inner}</a>`
    : html`<div class="nav-link nav-profile is-static" title="${lastSignedIn(profile) || profile.name}">${inner}</div>`;
};

/**
 * Sidebar footer: the Dark mode switch, and under it the Log out button.
 * With who: true (portals without a profile item in the menu) the avatar, name and role are shown above them.
 */
export function sidebarFooter(profile, { who = true } = {}) {
  return html`<div class="sidebar-footer">
    ${who && html`<div class="who-row">
      <div class="avatar">${avatarMarkup(profile)}</div>
      <div class="who" title="${lastSignedIn(profile)}"><strong>${profile.name}</strong><span>${roleLabel(profile.role)}</span></div>
    </div>`}
    <button type="button" class="side-row" id="theme-switch" role="switch" aria-checked="false" title="Dark mode">
      <span class="theme-icon" aria-hidden="true">${icon('moon')}${icon('sun')}</span><span class="side-label">Dark mode</span><span class="switch" aria-hidden="true"><i></i></span>
    </button>
    <button type="button" class="side-row side-logout" id="logout" title="Log out">${icon('logout')}<span class="side-label">Log out</span></button>
  </div>`;
}

/** First tab stop on every page: jumps over the menu to the content. */
export const skipLink = html`<button type="button" class="skip-link" id="skip-link">Skip to content</button>`;

/** Bar above the page content: collapse the sidebar. Apps add more buttons to #topbar-actions. (Dark mode is in the sidebar.) */
export const topbar = () => html`
  <header class="topbar">
    <button type="button" class="icon-btn" id="collapse" aria-label="Collapse the menu" aria-pressed="false">${icon('menu')}</button>
    <div class="topbar-actions" id="topbar-actions"></div>
  </header>`;

/** Hooks up the skip link, the sidebar collapse button and the theme button. Call after the shell is rendered. */
export function wireShell() {
  const shell = document.querySelector('.shell');
  const collapse = document.getElementById('collapse');
  const apply = (collapsed) => {
    shell.classList.toggle('collapsed', collapsed);
    collapse.setAttribute('aria-pressed', String(collapsed));
    collapse.setAttribute('aria-label', collapsed ? 'Expand the menu' : 'Collapse the menu');
  };
  let saved = false;
  try {
    saved = localStorage.getItem('lcs-collapsed') === '1';
  } catch {
    /* ignore */
  }
  apply(saved);
  collapse.onclick = () => {
    const next = !shell.classList.contains('collapsed');
    apply(next);
    try {
      localStorage.setItem('lcs-collapsed', next ? '1' : '0');
    } catch {
      /* ignore */
    }
  };

  // Dark mode: an on/off switch in the sidebar, just above Log out.
  const themeSwitch = document.getElementById('theme-switch');
  if (themeSwitch) {
    const paintTheme = () => {
      const dark = currentTheme() === 'dark';
      themeSwitch.setAttribute('aria-checked', String(dark));
      themeSwitch.classList.toggle('on', dark);
      themeSwitch.title = dark ? 'Dark mode: on' : 'Dark mode: off';
    };
    paintTheme();
    themeSwitch.onclick = () => toggleThemeWithMotion(themeSwitch.querySelector('.switch'), paintTheme);
  }

  document.getElementById('skip-link').onclick = () => document.getElementById('main')?.focus();
}

export const brandBlock = (subtitle) =>
  html`<div class="brand">${raw(SEAL)}<div><span class="brand-name">LOCAL COMMUNITY SERVICES</span><small>${subtitle}</small></div></div>`;

const PORTAL_LABELS = { admin: 'Admin portal', staff: 'Staff portal', resident: 'Resident portal', login: 'Welcome' };

/** Sign-in screen with the same look as the landing page hero: headline on the left, the form on the right. */
export function authScreen({ theme = 'admin', headline, blurb, points, form }) {
  const words = String(headline).split(' ');
  const first = words.slice(0, -3).join(' ');
  const last = words.slice(-3).join(' ');
  return html`
    <div class="auth auth-${theme}">
      <div class="hero-bg" aria-hidden="true"><span class="orb o1"></span><span class="orb o2"></span></div>
      <header class="auth-top">
        <a class="brand" href="${HOME_URL}" aria-label="LOCAL COMMUNITY SERVICES home">${raw(SEAL)}<span class="brand-name">LOCAL COMMUNITY SERVICES</span></a>
        <div class="auth-top-actions">
          <button type="button" class="icon-btn" id="auth-theme"></button>
          <a class="btn btn-ghost" href="${HOME_URL}">← Back to home</a>
        </div>
      </header>
      <div class="auth-grid">
        <section class="auth-copy">
          <span class="eyebrow">${icon('shield')}<span>${PORTAL_LABELS[theme] || 'Portal'}</span></span>
          <h1>${first} <em>${last}</em></h1>
          <p class="lead">${blurb}</p>
          <ul class="chips">${points.map(([ic, text]) => html`<li>${icon(ic)}<span>${text}</span></li>`)}</ul>
        </section>
        <section class="auth-panel">
          ${form}
          <p class="auth-foot">© LOCAL COMMUNITY SERVICES · Serving the City of Caloocan</p>
        </section>
      </div>
    </div>`;
}

/** Hooks up the light/dark button of the sign-in screen (authScreen). */
export function wireAuthTheme() {
  const themeBtn = document.getElementById('auth-theme');
  if (!themeBtn) return;
  // both icons are there; CSS turns the moon into the sun (and back) with a spin
  themeBtn.innerHTML = `<span class="theme-icon" aria-hidden="true">${icon('moon')}${icon('sun')}</span>`;
  const paint = () => {
    const dark = currentTheme() === 'dark';
    themeBtn.classList.toggle('on', dark);
    themeBtn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
    themeBtn.title = dark ? 'Light mode' : 'Dark mode';
  };
  paint();
  themeBtn.onclick = () => {
    themeBtn.classList.remove('spin');
    void themeBtn.offsetWidth; // restart the little pop on every click
    themeBtn.classList.add('spin');
    toggleThemeWithMotion(themeBtn, paint);
  };
}

// ---- Password fields: show/hide button, Caps Lock warning, strength meter ----------------------------------------

/** A labelled password input with a lock icon and a show/hide button. */
export const passwordField = ({ id, name = id, label, autocomplete = 'current-password', placeholder = '', required = true }) => html`
  <div class="field"><label for="${id}">${label}</label>
    <div class="input-wrap">${icon('lock')}<input id="${id}" name="${name}" type="password" autocomplete="${autocomplete}" placeholder="${placeholder}" ${required && 'required'} />
      <button type="button" class="pw-toggle" data-pw-eye aria-label="Show password" aria-pressed="false">${icon('eye')}</button></div></div>`;

function toggleEye(button) {
  const input = button.closest('.input-wrap')?.querySelector('input');
  if (!input) return;
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  button.innerHTML = String(icon(show ? 'eye-off' : 'eye'));
  button.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  button.setAttribute('aria-pressed', String(show));
}
document.addEventListener('click', (e) => {
  const button = e.target.closest?.('[data-pw-eye]');
  if (button) toggleEye(button);
});

/** Adds the show/hide button to every plain password input inside `root` (used for dialogs). */
export function enhancePasswordFields(root) {
  for (const input of root.querySelectorAll('input[type=password]')) {
    if (input.closest('.input-wrap')) continue;
    const wrap = document.createElement('div');
    wrap.className = 'input-wrap input-wrap-plain';
    input.before(wrap);
    wrap.append(input);
    wrap.insertAdjacentHTML('beforeend', `<button type="button" class="pw-toggle" data-pw-eye aria-label="Show password" aria-pressed="false">${icon('eye')}</button>`);
  }
}

// "Caps Lock is on" under any password field while it is focused.
function capsLockCheck(e) {
  const input = e.target;
  if (!(input instanceof HTMLInputElement)) return;
  const isPassword = input.type === 'password' || input.closest('.input-wrap')?.querySelector('[data-pw-eye]');
  if (!isPassword) return;
  const on = e.type !== 'focusout' && e.getModifierState?.('CapsLock') === true;
  if (on && !input._caps) {
    const note = document.createElement('span');
    note.className = 'caps-note';
    note.setAttribute('role', 'status');
    note.innerHTML = String(icon('lock')) + '<span>Caps Lock is on</span>';
    fieldHome(input).after(note);
    input._caps = note;
  } else if (!on && input._caps) {
    input._caps.remove();
    input._caps = null;
  }
}
for (const type of ['keydown', 'keyup', 'focusout']) document.addEventListener(type, capsLockCheck);

/** Live strength bar and requirement checklist (markup). Connect it to an input with wireStrength(). */
export const strengthMeter = () => html`
  <div class="pw-meter" data-score="0">
    <div class="pw-bar" aria-hidden="true"><i></i></div>
    <span class="pw-label" aria-live="polite"></span>
    <ul class="pw-rules">${PASSWORD_RULES.map((r) => html`<li data-rule="${r.key}">${icon('check')}<span>${r.label}</span></li>`)}</ul>
  </div>`;

export function wireStrength(input, meter) {
  const bar = meter.querySelector('.pw-bar i');
  const label = meter.querySelector('.pw-label');
  const update = () => {
    const value = input.value;
    const score = passwordScore(value);
    meter.dataset.score = String(score);
    bar.style.width = `${score * 25}%`;
    label.textContent = score ? `Password strength: ${SCORE_LABELS[score]}` : '';
    for (const rule of PASSWORD_RULES) meter.querySelector(`[data-rule="${rule.key}"]`).classList.toggle('ok', rule.test(value));
  };
  input.addEventListener('input', update);
  update();
}

// ---- Idle sign-out ---------------------------------------------------------------------------------------------------

/**
 * Signs the person out after `seconds` without activity. One minute before (warnSeconds), a dialog counts down and lets
 * them stay signed in. While the dialog is open, moving the mouse does not hide it: only its buttons do.
 * Returns a function that stops the watcher.
 */
export function startIdleLogout({ seconds, warnSeconds = 60, onTimeout }) {
  const EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
  let last = Date.now();
  let dlg = null;

  const touch = () => {
    if (!dlg) last = Date.now();
  };
  EVENTS.forEach((name) => window.addEventListener(name, touch, { passive: true }));

  function stay() {
    last = Date.now();
    dlg?.close();
  }

  function openWarning() {
    dlg = document.createElement('dialog');
    dlg.className = 'dialog';
    dlg.setAttribute('role', 'alertdialog');
    dlg.setAttribute('aria-labelledby', 'idle-title');
    render(
      dlg,
      html`<h2 id="idle-title">Still there?</h2>
        <p>You will be signed out in <strong id="idle-count">${warnSeconds}</strong> seconds because you have been inactive.</p>
        <div class="dialog-actions">
          <button type="button" class="btn btn-ghost" data-signout>Sign out now</button>
          <button type="button" class="btn btn-primary" data-stay autofocus>Stay signed in</button>
        </div>`
    );
    document.body.append(dlg);
    dlg.querySelector('[data-stay]').onclick = stay;
    dlg.querySelector('[data-signout]').onclick = () => {
      stop();
      onTimeout();
    };
    dlg.addEventListener('cancel', (e) => {
      e.preventDefault(); // Esc counts as "stay signed in"
      stay();
    });
    dlg.addEventListener('close', () => {
      dlg?.remove();
      dlg = null;
    });
    dlg.showModal();
  }

  const timer = setInterval(() => {
    const idle = (Date.now() - last) / 1000;
    if (idle >= seconds) {
      stop();
      onTimeout();
    } else if (idle >= seconds - warnSeconds) {
      if (!dlg) openWarning();
      const count = dlg?.querySelector('#idle-count');
      if (count) count.textContent = String(Math.ceil(seconds - idle));
    }
  }, 1000);

  function stop() {
    clearInterval(timer);
    EVENTS.forEach((name) => window.removeEventListener(name, touch));
    dlg?.close();
  }
  return stop;
}

/** Name / phone / address inputs, pre-filled from a user (used by the edit dialogs and the profile page). */
export const contactFields = (u = {}) => html`
  <div class="field"><label>Full name</label><input name="name" value="${u.name || ''}" maxlength="100" required /></div>
  <div class="field"><label>Phone number</label><input name="phone" type="tel" value="${u.phone || ''}" maxlength="30" placeholder="e.g. 0917 123 4567" /></div>
  <div class="field"><label>Address</label><input name="address" value="${u.address || ''}" maxlength="200" placeholder="Purok / street / barangay" /></div>`;

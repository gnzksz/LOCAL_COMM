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

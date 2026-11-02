// Small SVG charts (no library). Colours come from CSS variables, so they follow the light/dark theme.
import { esc, html, raw } from './ui.js';

const DAY = 864e5;
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const parseDay = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Counts reports per day (or per week / month for long ranges) between `from` and `to` (YYYY-MM-DD, either may be empty).
 * Returns { labels, reported, resolved, step } where step is the bucket size in days.
 */
export function bucketize(list, from, to) {
  const end = startOfDay(to ? parseDay(to) : new Date());
  const created = list.map((r) => startOfDay(new Date(r.created_at)));
  let start = from ? parseDay(from) : created.length ? new Date(Math.min(...created)) : end;
  if (start > end) start = end;
  const days = Math.round((end - start) / DAY) + 1;
  const step = days <= 45 ? 1 : days <= 400 ? 7 : 30;
  const count = Math.ceil(days / step);

  const at = (date) => {
    const i = Math.floor(Math.round((startOfDay(date) - start) / DAY) / step);
    return i >= 0 && i < count ? i : -1;
  };
  const reported = new Array(count).fill(0);
  const resolved = new Array(count).fill(0);
  for (const r of list) {
    const c = at(new Date(r.created_at));
    if (c >= 0) reported[c]++;
    if (r.resolved_at) {
      const s = at(new Date(r.resolved_at));
      if (s >= 0) resolved[s]++;
    }
  }
  const labels = reported.map((_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i * step);
    return step === 30 ? `${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}` : `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  });
  return { labels, reported, resolved, step };
}

// The top of the y axis: four equal steps of 1, 2, 5 or 10 times a power of ten (at least 4 in total).
const niceMax = (n) => {
  const quarter = n / 4;
  const pow = 10 ** Math.floor(Math.log10(quarter));
  const f = quarter / pow;
  return Math.max(4, (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow * 4);
};

/** Line chart with one or more series. series: [{ name, values, color }] (color is any CSS colour, usually var(--x)). */
export function lineChart({ labels, series, unit = 'day' }) {
  const W = 680;
  const H = 250;
  const pad = { l: 34, r: 14, t: 14, b: 30 };
  const max = niceMax(Math.max(1, ...series.flatMap((s) => s.values)));
  const n = labels.length;
  const x = (i) => pad.l + (n === 1 ? (W - pad.l - pad.r) / 2 : (i / (n - 1)) * (W - pad.l - pad.r));
  const y = (v) => pad.t + (1 - v / max) * (H - pad.t - pad.b);

  const ticks = [0, 1, 2, 3, 4].map((k) => (max / 4) * k);
  const every = Math.max(1, Math.ceil(n / 7));
  const total = series[0].values.reduce((a, b) => a + b, 0);

  const grid = ticks
    .map((t) => `<line class="grid" x1="${pad.l}" x2="${W - pad.r}" y1="${y(t)}" y2="${y(t)}"/><text x="${pad.l - 8}" y="${y(t) + 4}" text-anchor="end">${Number.isInteger(t) ? t : t.toFixed(1)}</text>`)
    .join('');
  const xlabels = labels
    .map((l, i) => (i % every === 0 ? `<text x="${x(i)}" y="${H - 8}" text-anchor="middle">${esc(l)}</text>` : ''))
    .join('');
  const lines = series
    .map((s, si) => {
      const pts = s.values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
      const area = si === 0 ? `<path d="M${x(0).toFixed(1)},${y(0)} L${pts.join(' L')} L${x(n - 1).toFixed(1)},${y(0)} Z" fill="${s.color}" opacity=".10"/>` : '';
      const dots = s.values
        .map((v, i) => `<circle class="dot" cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="${n > 40 ? 0 : 3.5}" fill="${s.color}"><title>${esc(labels[i])}${unit === 'week' ? ' (week)' : ''}: ${v} ${esc(s.name.toLowerCase())}</title></circle>`)
        .join('');
      return `${area}<polyline class="line" stroke="${s.color}" points="${pts.join(' ')}"/>${dots}`;
    })
    .join('');

  return html`
    <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${series.map((s) => `${s.name} per ${unit}`).join(' and ')}. ${total} ${series[0].name.toLowerCase()} in total.">
      ${raw(grid)}<line class="axis" x1="${pad.l}" x2="${W - pad.r}" y1="${y(0)}" y2="${y(0)}"/>${raw(xlabels)}${raw(lines)}
    </svg>
    <ul class="legend">${series.map((s) => html`<li><i style="background:${s.color}"></i>${s.name} <b>${s.values.reduce((a, b) => a + b, 0)}</b></li>`)}</ul>`;
}

/** Donut chart. segments: [{ label, value, color }] */
export function donutChart({ segments, title = 'Total' }) {
  const total = segments.reduce((a, s) => a + s.value, 0);
  const R = 70;
  const C = 2 * Math.PI * R;
  let offset = 0;
  const arcs = total
    ? segments
        .filter((s) => s.value > 0)
        .map((s) => {
          const len = (s.value / total) * C;
          const arc = `<circle cx="100" cy="100" r="${R}" fill="none" stroke="${s.color}" stroke-width="26" stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}" transform="rotate(-90 100 100)"><title>${esc(s.label)}: ${s.value}</title></circle>`;
          offset += len;
          return arc;
        })
        .join('')
    : `<circle cx="100" cy="100" r="${R}" fill="none" stroke="var(--track)" stroke-width="26"/>`;

  return html`
    <div class="donut-wrap">
      <svg class="donut" viewBox="0 0 200 200" role="img" aria-label="${title}: ${total}. ${segments.map((s) => `${s.label} ${s.value}`).join(', ')}">
        ${raw(arcs)}
        <text class="total" x="100" y="106" text-anchor="middle">${total}</text>
        <text class="sub" x="100" y="126" text-anchor="middle">${title}</text>
      </svg>
      <ul class="legend">${segments.map((s) => html`<li><i style="background:${s.color}"></i>${s.label} <b>${s.value}</b>${total ? html` <span class="muted small">(${Math.round((s.value / total) * 100)}%)</span>` : ''}</li>`)}</ul>
    </div>`;
}

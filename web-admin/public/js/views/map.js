import { TILES, loadLeaflet } from '../leaflet.js';
import { subscribeRequests } from '../service.js';
import { emptyState, errorState, esc, html, loading, render, shortId, timeAgo } from '../ui.js';

const STATUSES = [
  ['Pending', 'Pending', 'var(--st-pending)'],
  ['Assigned', 'Assigned', 'var(--st-assigned)'],
  ['In Progress', 'In progress', 'var(--st-in-progress)'],
  ['Resolved', 'Resolved', 'var(--st-resolved)'],
  ['Rejected', 'Rejected', 'var(--st-rejected)'],
  ['Archived', 'Archived', 'var(--st-archived)'],
];
const COLOR = Object.fromEntries(STATUSES.map(([key, , color]) => [key, color]));

// Where the map starts before any report is known (the whole Philippines).
const START_VIEW = { center: [12.8797, 121.774], zoom: 5 };

const pinSvg = (color) => `<svg viewBox="0 0 34 44" width="30" height="39" aria-hidden="true" style="color:${color}">
  <path d="M17 1C8.7 1 2 7.5 2 15.6 2 26.7 17 43 17 43s15-16.3 15-27.4C32 7.5 25.3 1 17 1z" fill="currentColor" stroke="#fff" stroke-width="2"/>
  <circle cx="17" cy="15.5" r="5.5" fill="#fff"/></svg>`;

export function mount(el) {
  // Resolved and closed reports start hidden so the map shows what still needs attention; the chips turn any status on or off.
  const shown = new Set(['Pending', 'Assigned', 'In Progress']);
  let all = [];
  let error = null;
  let ready = false;
  let map = null;
  let layer = null;
  let L = null;
  let fitted = false;
  let destroyed = false;

  render(
    el,
    html`
      <div class="page-head">
        <div><h1>Map overview</h1><div class="muted">Every report on one map. Pins are coloured by status; click a pin for details.</div></div>
      </div>
      <div class="chip-row" id="chips" role="group" aria-label="Show reports with status"></div>
      <div id="map-area"><div class="card">${loading()}</div></div>`
  );
  const chips = el.querySelector('#chips');
  const area = el.querySelector('#map-area');

  function drawChips() {
    render(
      chips,
      html`${STATUSES.map(([key, label, color]) => {
        const count = all.filter((r) => r.status === key).length;
        return html`<button type="button" class="chip" data-status="${key}" aria-pressed="${String(shown.has(key))}">
          <i style="width:10px;height:10px;border-radius:50%;background:${color};display:inline-block"></i>${label} <b>${count}</b></button>`;
      })}`
    );
  }

  function drawPins() {
    if (!map) return;
    layer.clearLayers();
    const rows = all.filter((r) => shown.has(r.status) && Number.isFinite(r.latitude) && Number.isFinite(r.longitude));
    for (const r of rows) {
      const icon = L.divIcon({ className: 'map-pin-status', html: pinSvg(COLOR[r.status] || COLOR.Archived), iconSize: [30, 39], iconAnchor: [15, 37], popupAnchor: [0, -34] });
      L.marker([r.latitude, r.longitude], { icon, title: `${r.issue_type} (${r.status})`, alt: `${r.issue_type}, ${r.status}` })
        .bindPopup(
          `<div class="map-popup"><strong>${esc(r.issue_type)} #${esc(shortId(r.id))}</strong>
            <div>${esc(r.status)} · ${esc(timeAgo(r.created_at))}</div>
            <div class="muted small">${esc(r.address || r.resident_name)}</div>
            <a href="#/requests/${esc(r.id)}">Open report →</a></div>`
        )
        .addTo(layer);
    }
    // Zoom to the pins once; later live updates must not move the map under the admin's hands.
    if (!fitted && rows.length) {
      map.fitBounds(L.latLngBounds(rows.map((r) => [r.latitude, r.longitude])), { padding: [40, 40], maxZoom: 16 });
      fitted = true;
    }
  }

  // Starts the map once, even when several live updates arrive while the map library is still loading.
  let starting = null;
  function ensureMap() {
    if (map) return Promise.resolve();
    starting ??= (async () => {
      render(area, html`<div class="map-overview" id="overview" role="region" aria-label="Map of all reports"></div>`);
      try {
        L = await loadLeaflet();
        if (destroyed) return;
        map = L.map(el.querySelector('#overview')).setView(START_VIEW.center, START_VIEW.zoom);
        L.tileLayer(TILES.url, TILES.options).addTo(map);
        layer = L.layerGroup().addTo(map);
      } catch (err) {
        starting = null;
        render(area, errorState(err));
      }
    })();
    return starting;
  }

  const stop = subscribeRequests((list, err) => {
    error = err;
    all = list;
    ready = !err || list.length > 0;
    drawChips();
    if (error && !ready) return render(area, errorState(error));
    if (!ready) return;
    if (!list.length) {
      map?.remove();
      map = null;
      starting = null;
      fitted = false;
      return render(area, html`<div class="card">${emptyState({ icon: 'map', title: 'No reports to show yet', text: 'Pins appear here as residents send reports with a location.' })}</div>`);
    }
    ensureMap().then(drawPins);
  });

  chips.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-status]');
    if (!chip) return;
    const key = chip.dataset.status;
    if (shown.has(key)) shown.delete(key);
    else shown.add(key);
    drawChips();
    drawPins();
  });

  return {
    destroy() {
      destroyed = true;
      stop();
      map?.remove();
    },
  };
}

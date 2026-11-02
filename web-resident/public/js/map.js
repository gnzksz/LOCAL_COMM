// Location picker: a Leaflet map (OpenStreetMap tiles) with ONE draggable pin.

import { loadLeaflet, TILES } from './leaflet.js';

// Where the map starts when no pin is set yet (the whole Philippines).
const START_VIEW = { center: [12.8797, 121.774], zoom: 5 };

const PIN_SVG = `<svg viewBox="0 0 34 44" width="34" height="44" aria-hidden="true">
  <path d="M17 1C8.7 1 2 7.5 2 15.6 2 26.7 17 43 17 43s15-16.300 15-27.400C32 7.500 25.300 1 17 1z" fill="currentColor" stroke="#fff" stroke-width="2"/>
  <circle cx="17" cy="15.500" r="5.500" fill="#fff"/></svg>`;

/**
 * Creates the map inside `el`. `onChange(lat, lng)` is called when the user clicks the map or drags the pin.
 * Returns { setPoint(lat, lng, { zoom }), invalidate(), destroy() }; setPoint() does NOT call onChange.
 */
export async function createLocationPicker(el, { onChange }) {
  const L = await loadLeaflet();
  const map = L.map(el, { zoomControl: true, attributionControl: true }).setView(START_VIEW.center, START_VIEW.zoom);
  L.tileLayer(TILES.url, TILES.options).addTo(map);

  const icon = L.divIcon({ className: 'map-pin', html: PIN_SVG, iconSize: [34, 44], iconAnchor: [17, 42] });
  let marker = null;

  function place(lat, lng) {
    if (!marker) {
      marker = L.marker([lat, lng], { draggable: true, icon, keyboard: false }).addTo(map);
      marker.on('dragend', () => {
        const p = marker.getLatLng();
        onChange(p.lat, p.lng);
      });
    } else {
      marker.setLatLng([lat, lng]);
    }
  }

  map.on('click', (e) => {
    place(e.latlng.lat, e.latlng.lng);
    onChange(e.latlng.lat, e.latlng.lng);
  });

  return {
    setPoint(lat, lng, { zoom = 17 } = {}) {
      place(lat, lng);
      map.setView([lat, lng], Math.max(map.getZoom(), zoom));
    },
    invalidate: () => map.invalidateSize(),
    destroy: () => map.remove(),
  };
}

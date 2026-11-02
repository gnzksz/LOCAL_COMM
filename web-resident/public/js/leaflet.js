// Loads Leaflet (OpenStreetMap maps) only when a page needs it, pinned to an exact version and checked with an integrity hash.
// Shared by the resident location picker and the admin overview map.

const LEAFLET = {
  css: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  cssHash: 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=',
  js: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  jsHash: 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=',
};

let loading = null;

export function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  loading ??= new Promise((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = LEAFLET.css;
    css.integrity = LEAFLET.cssHash;
    css.crossOrigin = '';
    document.head.append(css);

    const script = document.createElement('script');
    script.src = LEAFLET.js;
    script.integrity = LEAFLET.jsHash;
    script.crossOrigin = '';
    script.onload = () => resolve(window.L);
    script.onerror = () => {
      loading = null; // allow a retry on the next visit
      reject(new Error('The map could not be loaded.'));
    };
    document.head.append(script);
  });
  return loading;
}

export const TILES = {
  url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  options: {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
  },
};

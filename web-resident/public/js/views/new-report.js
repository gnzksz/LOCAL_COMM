import { ISSUE_TYPES } from '../config.js';
import { createLocationPicker } from '../map.js';
import { compressPhoto, submitReport } from '../service.js';
import { clearFieldError, html, icon, render, setFieldError, toast, validateForm } from '../ui.js';

export function mount(el) {
  let compressed = null; // { photo, thumb }, set once a photo was chosen and compressed
  let picker = null; // the map, once Leaflet has loaded

  render(
    el,
    html`
      <div class="page-head"><div><h1>New report</h1>
        <div class="muted">A photo and a location are required, so the barangay can find and fix the problem.</div></div></div>

      <form class="card report-card" id="form" novalidate>
        <div class="report-grid">
          <!-- left: what and where (in words) -->
          <section class="report-col">
            <h2 class="section-title"><span class="step-no">1</span>What is the problem?</h2>
            <div class="field"><label for="issue">Issue type</label>
              <select id="issue" name="issue_type" required><option value="">Choose…</option>
                ${ISSUE_TYPES.map((t) => html`<option>${t}</option>`)}</select></div>
            <div class="field"><label for="desc">Description</label>
              <textarea id="desc" name="description" maxlength="2000" required placeholder="Describe the problem: what is wrong, how long it has been like this, anything that helps the team find it."></textarea></div>
            <div class="field"><label for="addr">Address / landmark <span class="muted">(optional)</span></label>
              <input id="addr" name="address" placeholder="e.g. Purok 3, near the chapel" /></div>
          </section>

          <!-- right: photo and map -->
          <section class="report-col">
            <h2 class="section-title"><span class="step-no">2</span>Photo evidence</h2>
            <label class="dropzone" id="drop" for="photo">
              ${icon('upload')}
              <strong>Drag &amp; drop a photo here</strong>
              <span class="muted small">or click to browse · JPG, PNG or WEBP</span>
            </label>
            <input class="sr-only" id="photo" name="photo" type="file" accept="image/*" />
            <div class="photo-preview" id="preview" hidden>
              <img id="preview-img" alt="Preview of the chosen photo" />
              <div class="photo-info"><strong id="preview-name"></strong><span class="muted small" id="preview-size"></span>
                <button type="button" class="btn btn-sm" id="remove">Remove photo</button></div>
            </div>

            <h2 class="section-title"><span class="step-no">3</span>Location</h2>
            <div class="map-box" id="map"><div class="map-note">Loading map…</div></div>
            <p class="muted small map-help">Click the map to drop a pin, then drag it to fine-tune. Or use your current location.</p>
            <div class="coords">
              <div class="field"><label for="lat">Latitude</label><input id="lat" name="latitude" type="number" step="any" placeholder="e.g. 14.5995" required /></div>
              <div class="field"><label for="lng">Longitude</label><input id="lng" name="longitude" type="number" step="any" placeholder="e.g. 120.9842" required /></div>
              <button type="button" class="btn" id="locate">${icon('pin')}<span>Use my location</span></button>
            </div>
          </section>
        </div>

        <p class="form-error" hidden></p>
        <div class="form-actions">
          <a class="btn" href="#/reports">Cancel</a>
          <button class="btn btn-primary" type="submit">Send report</button>
        </div>
      </form>`
  );

  const form = el.querySelector('#form');
  const error = form.querySelector('.form-error');
  const drop = el.querySelector('#drop');
  const preview = el.querySelector('#preview');
  const showError = (message) => {
    error.textContent = message;
    error.hidden = !message;
  };

  // ---- photo: click, drag & drop, preview ----------------------------------------------------------------
  async function chooseFile(file) {
    compressed = null;
    showError('');
    clearFieldError(form.photo);
    drop.classList.remove('invalid');
    if (!file) return;
    if (!file.type.startsWith('image/')) return showError('Please choose an image file (JPG, PNG or WEBP).');
    try {
      compressed = await compressPhoto(file);
      el.querySelector('#preview-img').src = compressed.photo;
      el.querySelector('#preview-name').textContent = file.name;
      el.querySelector('#preview-size').textContent = `${Math.round(compressed.photo.length / 1024)} KB after compressing`;
      drop.hidden = true;
      preview.hidden = false;
    } catch (err) {
      showError(err.message);
    }
  }
  form.photo.addEventListener('change', () => chooseFile(form.photo.files[0]));
  el.querySelector('#remove').addEventListener('click', () => {
    compressed = null;
    form.photo.value = '';
    preview.hidden = true;
    drop.hidden = false;
  });
  for (const type of ['dragenter', 'dragover']) {
    drop.addEventListener(type, (e) => {
      e.preventDefault();
      drop.classList.add('over');
    });
  }
  for (const type of ['dragleave', 'drop']) drop.addEventListener(type, () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    chooseFile(e.dataTransfer?.files?.[0]);
  });

  // ---- location: the map pin and the two number boxes always agree ----------------------------------------------
  const setInputs = (lat, lng) => {
    form.latitude.value = lat.toFixed(6);
    form.longitude.value = lng.toFixed(6);
    showError('');
  };
  createLocationPicker(el.querySelector('#map'), { onChange: setInputs })
    .then((p) => {
      picker = p;
      el.querySelector('#map .map-note')?.remove();
      setTimeout(() => picker?.invalidate(), 150);
    })
    .catch((err) => {
      el.querySelector('#map').innerHTML = `<div class="map-note">${err.message} You can still type the latitude and longitude.</div>`;
    });

  const typedPoint = () => {
    const lat = Number.parseFloat(form.latitude.value);
    const lng = Number.parseFloat(form.longitude.value);
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) picker?.setPoint(lat, lng);
  };
  form.latitude.addEventListener('change', typedPoint);
  form.longitude.addEventListener('change', typedPoint);

  const locate = el.querySelector('#locate');
  locate.addEventListener('click', () => {
    if (!navigator.geolocation) return showError('This browser cannot give your location. Click the map or type it in.');
    locate.disabled = true;
    locate.querySelector('span').textContent = 'Locating…';
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setInputs(pos.coords.latitude, pos.coords.longitude);
        picker?.setPoint(pos.coords.latitude, pos.coords.longitude);
        locate.disabled = false;
        locate.querySelector('span').textContent = 'Use my location';
      },
      () => {
        showError('Could not get your location. Allow it in the browser, click the map, or type the coordinates.');
        locate.disabled = false;
        locate.querySelector('span').textContent = 'Use my location';
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  });

  // ---- submit: same checks and same data as before --------------------------------------------------------------
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    showError('');
    // "Photo and location attached?" -> No: complete details. Every problem is shown under its own field.
    const fieldsOk = validateForm(form);
    for (const input of [form.latitude, form.longitude]) {
      if (input.validity.valueMissing) setFieldError(input, 'Click the map or use your location.');
    }
    if (!compressed) {
      setFieldError(form.photo, 'Please attach a photo of the problem.', drop);
      drop.classList.add('invalid');
      if (fieldsOk) drop.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    if (!fieldsOk || !compressed) return;
    const latitude = Number.parseFloat(form.latitude.value);
    const longitude = Number.parseFloat(form.longitude.value);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return setFieldError(form.latitude, 'Please add the location.');

    const button = form.querySelector('[type=submit]');
    button.disabled = true;
    try {
      const id = await submitReport({
        issue_type: form.issue_type.value,
        description: form.description.value,
        address: form.address.value,
        latitude,
        longitude,
        ...compressed,
      });
      toast('Report sent. Status: Pending', 'success');
      location.hash = `#/reports/${id}`;
    } catch (err) {
      showError(err.message);
      button.disabled = false;
    }
  });

  return { destroy: () => picker?.destroy() };
}

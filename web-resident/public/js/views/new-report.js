import { ISSUE_TYPES } from '../config.js';
import { compressPhoto, submitReport } from '../service.js';
import { html, render, toast } from '../ui.js';

export function mount(el) {
  let compressed = null; // { photo, thumb }

  render(
    el,
    html`
      <div class="page-head"><div><h1>New report</h1>
        <div class="muted">A photo and a location are required (like in the mobile app).</div></div></div>
      <form class="card" id="form" style="max-width:560px">
        <div class="field"><label>Issue type</label>
          <select name="issue_type" required><option value="">Choose…</option>
            ${ISSUE_TYPES.map((t) => html`<option>${t}</option>`)}</select></div>
        <div class="field"><label>Description</label>
          <textarea name="description" maxlength="2000" required placeholder="What is the problem?"></textarea></div>
        <div class="field"><label>Photo evidence</label>
          <input type="file" name="photo" accept="image/*" /><div id="preview" style="margin-top:8px"></div></div>
        <div class="field"><label>Address / landmark (optional)</label><input name="address" /></div>
        <div class="field"><label>Location</label>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <input name="latitude" type="number" step="any" placeholder="Latitude" required style="flex:1;min-width:120px" />
            <input name="longitude" type="number" step="any" placeholder="Longitude" required style="flex:1;min-width:120px" />
            <button type="button" class="btn" id="locate">Use my location</button>
          </div></div>
        <p class="form-error" hidden></p>
        <div class="actions"><button class="btn btn-primary" type="submit">Send report</button>
          <a class="btn" href="#/reports">Cancel</a></div>
      </form>`
  );

  const form = el.querySelector('#form');
  const error = form.querySelector('.form-error');
  const preview = el.querySelector('#preview');
  const showError = (message) => {
    error.textContent = message;
    error.hidden = !message;
  };

  form.photo.addEventListener('change', async () => {
    compressed = null;
    preview.innerHTML = '';
    showError('');
    const file = form.photo.files[0];
    if (!file) return;
    try {
      compressed = await compressPhoto(file);
      preview.innerHTML = `<img class="thumb" style="width:120px;height:120px" src="${compressed.thumb.replace(/"/g, '')}" alt="" />
        <span class="muted small"> ${Math.round(compressed.photo.length / 1024)} KB after compressing</span>`;
    } catch (err) {
      showError(err.message);
    }
  });

  el.querySelector('#locate').onclick = () => {
    if (!navigator.geolocation) return showError('This browser cannot give your location. Type it in.');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        form.latitude.value = pos.coords.latitude.toFixed(6);
        form.longitude.value = pos.coords.longitude.toFixed(6);
        showError('');
      },
      () => showError('Could not get your location. Allow it in the browser, or type the coordinates.')
    );
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    showError('');
    // "Photo and location attached?" -> No: complete details
    if (!compressed) return showError('Please attach a photo.');
    const latitude = Number.parseFloat(form.latitude.value);
    const longitude = Number.parseFloat(form.longitude.value);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return showError('Please add the location.');

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
}

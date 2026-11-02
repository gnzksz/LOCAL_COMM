import { getPhoto, submitFeedback, watchHistory, watchRequest } from '../service.js';
import { breadcrumbs, errorState, formatDate, html, loading, mapEmbed, render, shortId, stars, statusBadge, stepper, timeline, toast } from '../ui.js';

export function mount(el, [id]) {
  render(el, loading('page'));

  let request;
  let history = [];
  let photo = null;
  let error = null;
  let loaded = false;
  let rating = 0;

  getPhoto(id).then((p) => {
    photo = p;
    if (loaded) draw();
  }).catch(() => {});

  function draw() {
    if (error) return render(el, errorState(error));
    if (!loaded) return render(el, loading('page'));
    if (!request) return render(el, errorState(new Error('Report not found')));
    const r = request;
    const canRate = r.status === 'Resolved' && r.rating == null;
    render(
      el,
      html`
        ${breadcrumbs([['My reports', '#/reports'], [`${r.issue_type} #${shortId(r.id)}`]])}
        <div class="page-head">
          <div><h1>${r.issue_type} <span class="muted">#${shortId(r.id)}</span></h1>
            <div>${statusBadge(r.status)} <span class="muted">sent ${formatDate(r.created_at)}</span></div></div>
        </div>
        ${stepper(r.status)}
        <div class="detail">
          <div class="stack">
            <div class="card">
              <img class="detail-photo" data-zoom src="${photo || r.thumb}" alt="Photo evidence: click to enlarge" />
              <h2 style="margin-top:14px">Description</h2>
              <p style="white-space:pre-wrap">${r.description}</p>
              <dl class="kv">
                <dt>Address</dt><dd>${r.address || '—'}</dd>
                <dt>Assigned to</dt><dd>${r.assigned_staff_name ? html`${r.assigned_staff_name} · ${r.assigned_department_name}` : '—'}</dd>
              </dl>
              ${r.rejection_reason && html`<p class="callout"><strong>Not accepted:</strong> ${r.rejection_reason}</p>`}
              ${r.rating && html`<h2 style="margin-top:14px">Your feedback</h2><p>${stars(r.rating)} ${r.feedback && html`<br />${r.feedback}`}</p>`}
            </div>
            ${canRate && html`
              <form class="card" id="feedback">
                <h2>Rate the service</h2>
                <div class="field" id="stars" style="font-size:28px;cursor:pointer;color:var(--gold-ink)">
                  ${[1, 2, 3, 4, 5].map((n) => html`<span data-star="${n}">${n <= rating ? '★' : '☆'}</span>`)}</div>
                <div class="field"><label>Feedback (optional)</label><textarea name="feedback"></textarea></div>
                <p class="form-error" hidden></p>
                <button class="btn btn-primary" type="submit">Send feedback</button>
              </form>`}
          </div>
          <div class="stack">
            ${mapEmbed(r.latitude, r.longitude)}
            <div class="card"><h2>Status history</h2>${timeline(history)}</div>
          </div>
        </div>`
    );

    el.querySelector('#stars')?.addEventListener('click', (e) => {
      const star = e.target.closest('[data-star]');
      if (!star) return;
      rating = Number(star.dataset.star);
      el.querySelectorAll('[data-star]').forEach((s) => (s.textContent = Number(s.dataset.star) <= rating ? '★' : '☆'));
    });
    const form = el.querySelector('#feedback');
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const message = form.querySelector('.form-error');
      if (!rating) {
        message.textContent = 'Choose 1 to 5 stars.';
        message.hidden = false;
        return;
      }
      try {
        await submitFeedback(id, rating, form.feedback.value);
        toast('Thank you for your feedback', 'success');
      } catch (err) {
        message.textContent = err.message;
        message.hidden = false;
      }
    });
  }

  const stops = [
    watchRequest(id, (r, err) => {
      request = r;
      error = err || null;
      loaded = true;
      draw();
    }),
    watchHistory(id, (h) => {
      history = h;
      if (loaded) draw();
    }),
  ];
  return { destroy: () => stops.forEach((stop) => stop()) };
}

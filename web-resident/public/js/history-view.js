// "Status history" page of the resident portal (master copy in web-admin, copied by
// firebase/scripts/sync-shared.js). It lists every status update of a live list of requests, newest first.
// One listener for the list, plus one history listener per request (added and removed as the list changes).
import { watchHistory } from './data.js';
import { emptyState, errorState, formatDate, html, loading, render, shortId, statusBadge } from './ui.js';

/**
 * Returns a view ({ mount }) for the router.
 *   watchList(user, cb)  live list of requests: cb(list, error?) ; returns an unsubscribe
 *   link(id)             address of one request's detail page
 *   subtitle             text under the title
 */
export function createHistoryView({ watchList, link, subtitle = 'Every status update, live.' }) {
  return {
    mount(el, _params, user) {
      render(
        el,
        html`
          <div class="page-head">
            <div><h1>Status history</h1><div class="muted">${subtitle}</div></div>
          </div>
          <div class="card" id="results">${loading()}</div>`
      );
      const results = el.querySelector('#results');
      const watchers = new Map(); // request id -> { request, entries, ready, stop }
      let failed = null;
      let listReady = false;

      function draw() {
        if (failed) return render(results, errorState(failed));
        const all = [...watchers.values()];
        if (!listReady || all.some((w) => !w.ready)) return;
        const items = all
          .flatMap((w) => w.entries.map((h) => ({ r: w.request, h })))
          .sort((a, b) => (b.h.created_at || '').localeCompare(a.h.created_at || ''));
        if (!items.length) {
          return render(results, emptyState({
            icon: 'clock',
            title: 'No status updates yet',
            text: 'Every status change (assigned, in progress, resolved…) will be listed here.',
          }));
        }
        render(
          results,
          html`<ol class="timeline history-list">${items.map(
            ({ r, h }) => html`<li>
              <div class="timeline-head">${statusBadge(h.status)}<time>${formatDate(h.created_at)}</time></div>
              <a class="history-report" href="${link(r.id)}"><strong>${r.issue_type}</strong> <span class="small muted">#${shortId(r.id)}</span></a>
              ${h.actor_name && html`<div class="muted small">by ${h.actor_name} (${h.actor_role})</div>`}
              ${h.note && html`<p>${h.note}</p>`}
            </li>`
          )}</ol>`
        );
      }

      const stopList = watchList(user, (list, err) => {
        if (err) {
          failed = err;
          return draw();
        }
        failed = null;
        listReady = true;
        const ids = new Set(list.map((r) => r.id));
        for (const [id, w] of watchers) {
          if (!ids.has(id)) {
            w.stop();
            watchers.delete(id);
          }
        }
        for (const r of list) {
          const known = watchers.get(r.id);
          if (known) {
            known.request = r;
            continue;
          }
          const w = { request: r, entries: [], ready: false, stop: () => {} };
          watchers.set(r.id, w);
          w.stop = watchHistory(r.id, (entries) => {
            w.entries = entries;
            w.ready = true;
            draw();
          });
        }
        draw();
      });

      return {
        destroy() {
          stopList();
          watchers.forEach((w) => w.stop());
          watchers.clear();
        },
      };
    },
  };
}

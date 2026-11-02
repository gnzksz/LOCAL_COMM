// Landing page: menu, reveal on scroll, English/Filipino toggle, live numbers, footer details, sticky button. No dependencies.
(() => {
  const SITE = window.SITE || {};
  document.documentElement.classList.add('js');
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- mobile menu ----------
  const burger = $('#burger');
  const menu = $('#menu');
  const closeMenu = () => {
    menu.classList.remove('open');
    burger.setAttribute('aria-expanded', 'false');
  };
  burger.addEventListener('click', () => {
    const open = menu.classList.toggle('open');
    burger.setAttribute('aria-expanded', String(open));
  });
  menu.addEventListener('click', (e) => {
    if (e.target.closest('a')) closeMenu();
  });
  document.addEventListener('keydown', (e) => e.key === 'Escape' && closeMenu());

  // ---------- reveal on scroll ----------
  const items = $$('.reveal');
  if ('IntersectionObserver' in window && !reduced) {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      }),
      { threshold: 0.12 }
    );
    items.forEach((el, i) => {
      el.style.transitionDelay = `${(i % 4) * 70}ms`;
      io.observe(el);
    });
  } else {
    items.forEach((el) => el.classList.add('in'));
  }

  // ---------- texts built by this script ----------
  const TEXT = {
    sample: 'Sample figures only. The real numbers appear here once there is data.',
    live: 'Live numbers, last updated',
    hrs: ' hrs',
    days: ' days',
  };

  // ---------- footer details from site-config.js ----------
  function fillSiteDetails() {
    const get = (path) => path.split('.').reduce((o, k) => o?.[k], SITE) ?? '';
    $$('[data-site]').forEach((el) => {
      el.textContent = get(el.dataset.site);
      if (el.hasAttribute('data-tel')) el.href = `tel:${String(el.textContent).replace(/[^\d+]/g, '')}`;
      if (el.hasAttribute('data-mail')) el.href = `mailto:${el.textContent}`;
    });
    const hours = $('#hours');
    hours.replaceChildren();
    for (const [days, time] of SITE.hours || []) {
      const dt = document.createElement('dt');
      const dd = document.createElement('dd');
      dt.textContent = days;
      dd.textContent = time;
      hours.append(dt, dd);
    }
    const hot = $('#hotlines');
    hot.replaceChildren();
    for (const [name, number] of SITE.hotlines || []) {
      const li = document.createElement('li');
      const label = document.createElement('span');
      const link = document.createElement('a');
      label.textContent = name;
      link.textContent = number;
      link.href = `tel:${number.replace(/[^\d+]/g, '')}`;
      li.append(label, link);
      hot.append(li);
    }
  }

  // ---------- live numbers: public_stats/summary in Firestore, read through the REST API (no SDK needed) ----------
  const numberOf = (field) => (field ? Number(field.integerValue ?? field.doubleValue ?? 0) : null);
  let stats = { received: 0, resolved: 0, avgHours: 0, live: false, updated: null };
  let counted = false;

  async function loadStats() {
    const { projectId, apiKey } = SITE.firebase || {};
    const sample = { ...SITE.fallbackStats, live: false, updated: null };
    if (!projectId) return sample;
    try {
      const res = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/public_stats/summary?key=${apiKey}`);
      if (!res.ok) throw new Error(String(res.status));
      const f = (await res.json()).fields || {};
      return {
        received: numberOf(f.reports_received) ?? 0,
        resolved: numberOf(f.reports_resolved) ?? 0,
        avgHours: numberOf(f.avg_resolution_hours) ?? 0,
        live: true,
        updated: f.updated_at?.timestampValue || null,
      };
    } catch {
      return sample; // offline, rules not published yet, or no admin has opened the dashboard yet
    }
  }

  // "36 hrs" below 48 hours, "3 days" above. Returns { value, unit } for the count-up.
  const avgDisplay = (hours) => (hours >= 48 ? { value: Math.round(hours / 24), unit: TEXT.days } : { value: Math.round(hours), unit: TEXT.hrs });

  function paintStats(animate) {
    const targets = { received: stats.received, resolved: stats.resolved, avg: avgDisplay(stats.avgHours).value };
    $('#avg-unit').textContent = avgDisplay(stats.avgHours).unit;
    for (const [name, target] of Object.entries(targets)) {
      const el = $(`[data-count="${name}"]`);
      if (!animate || reduced) {
        el.textContent = target.toLocaleString();
        continue;
      }
      const start = performance.now();
      const step = (now) => {
        const p = Math.min(1, (now - start) / 1400);
        el.textContent = Math.round(target * (1 - (1 - p) ** 3)).toLocaleString(); // ease-out
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }
  }

  function paintStatsNote() {
    const note = $('#stats-note');
    if (!note) return;
    const date = stats.updated ? new Date(stats.updated).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '';
    note.textContent = stats.live ? `${TEXT.live} ${date}.` : TEXT.sample;
    note.classList.toggle('is-sample', !stats.live);
    $('#avg-unit').textContent = avgDisplay(stats.avgHours).unit;
  }

  const statsReady = loadStats().then((s) => { stats = s; paintStatsNote(); });
  // count up the first time the numbers scroll into view
  const statsSection = $('#stats');
  const countUp = async () => {
    if (counted) return;
    counted = true;
    await statsReady;
    paintStats(true);
  };
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries, obs) => {
      if (entries.some((e) => e.isIntersecting)) {
        obs.disconnect();
        countUp();
      }
    }, { threshold: 0.3 }).observe(statsSection);
  } else {
    countUp();
  }

  // ---------- sticky "Report now" (phones): appears once the hero has scrolled out of view ----------
  const sticky = $('#sticky-cta');
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => { sticky.hidden = entry.isIntersecting; }, { threshold: 0 }).observe($('#hero'));
  }

  // ---------- start ----------
  $('#year').textContent = new Date().getFullYear();
  fillSiteDetails();
})();

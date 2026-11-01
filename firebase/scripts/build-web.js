// Firebase Hosting can only publish folders inside the firebase/ project, so copy everything into web-dist/
// right before deploying (web-dist/ is git-ignored and always rebuilt from scratch).
//
//   web-dist/site/            the one public site:  /  (landing page)  /login/  /admin/  /staff/  /resident/
//   web-dist/redirect/        tiny page used by the old separate addresses, which now redirect to the site above
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..', '..');
const out = path.resolve(import.meta.dirname, '..', 'web-dist');
const site = path.join(out, 'site');

const copy = (from, to) => {
  if (!fs.existsSync(from)) throw new Error(`Missing folder: ${from}`);
  fs.cpSync(from, to, { recursive: true });
  console.log(`${path.relative(root, from)} -> firebase/${path.relative(path.resolve(out, '..'), to)}`);
};

fs.rmSync(out, { recursive: true, force: true });
copy(path.join(root, 'landing', 'public'), site);
for (const app of ['login', 'admin', 'staff', 'resident']) copy(path.join(root, `web-${app}`, 'public'), path.join(site, app));

fs.mkdirSync(path.join(out, 'redirect'), { recursive: true });
fs.writeFileSync(
  path.join(out, 'redirect', 'index.html'),
  '<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=https://local-comm-bdae9.web.app/"><a href="https://local-comm-bdae9.web.app/">LOCAL COMMUNITY SERVICES has moved</a>\n'
);

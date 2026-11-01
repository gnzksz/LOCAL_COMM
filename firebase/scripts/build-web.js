// Firebase Hosting can only publish folders inside the firebase/ project, so copy the three web apps
// into web-dist/ right before deploying (web-dist/ is git-ignored and always rebuilt from scratch).
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..', '..');
const out = path.resolve(import.meta.dirname, '..', 'web-dist');

fs.rmSync(out, { recursive: true, force: true });
for (const app of ['admin', 'staff', 'resident']) {
  const from = path.join(root, `web-${app}`, 'public');
  if (!fs.existsSync(from)) throw new Error(`Missing folder: ${from}`);
  fs.cpSync(from, path.join(out, app), { recursive: true });
  console.log(`web-${app}/public -> firebase/web-dist/${app}`);
}

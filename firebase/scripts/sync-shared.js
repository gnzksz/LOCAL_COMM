// The web apps share a few files, so they never drift: this copies each master file to the other apps.
// Runs automatically before every deploy (npm run build:web).
//   web-admin  holds the master of firebase.js, ui.js, data.js and styles.css
//   web-staff  holds the master of the profile page (views/profile.js), used by staff AND residents
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..', '..');
const SHARED = [
  { file: 'js/firebase.js', from: 'web-admin', to: ['web-staff', 'web-resident', 'web-login'] },
  { file: 'js/ui.js', from: 'web-admin', to: ['web-staff', 'web-resident', 'web-login'] },
  { file: 'js/data.js', from: 'web-admin', to: ['web-staff', 'web-resident'] },
  { file: 'css/styles.css', from: 'web-admin', to: ['web-staff', 'web-resident', 'web-login'] },
  { file: 'js/views/profile.js', from: 'web-staff', to: ['web-resident'] },
];

let changed = 0;
for (const { file, from, to } of SHARED) {
  const source = fs.readFileSync(path.join(root, from, 'public', file));
  for (const app of to) {
    const target = path.join(root, app, 'public', file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    if (!fs.existsSync(target) || !fs.readFileSync(target).equals(source)) {
      fs.writeFileSync(target, source);
      console.log(`updated ${app}/public/${file}`);
      changed++;
    }
  }
}
console.log(changed ? `${changed} shared file(s) updated` : 'shared files already in sync');

// Serves firebase/web-dist/site on http://localhost:5000 the way Firebase Hosting does (index.html per folder,
// /admin -> /admin/). Run `npm run preview` (it rebuilds first). Add ?emulator to the address to use the emulators.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..', 'web-dist', 'site');
const port = Number(process.env.PORT) || 5000;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };

http
  .createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    let file = path.join(root, decodeURIComponent(url.pathname));
    if (file !== root && !file.startsWith(root + path.sep)) return res.writeHead(403).end();
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
      if (!url.pathname.endsWith('/')) return res.writeHead(301, { Location: url.pathname + '/' + url.search }).end();
      file = path.join(file, 'index.html');
    }
    if (!fs.existsSync(file)) return res.writeHead(404).end('Not found');
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  })
  .listen(port, () => console.log(`Preview of the whole site: http://localhost:${port}/`));

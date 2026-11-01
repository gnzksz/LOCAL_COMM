// Tiny static file server for local development (no dependencies).
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const root = path.join(import.meta.dirname, 'public');
const port = Number(process.env.PORT) || 5175;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

http
  .createServer((req, res) => {
    let file;
    try {
      file = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    } catch {
      return res.writeHead(400).end('Bad request');
    }
    if (file !== root && !file.startsWith(root + path.sep)) return res.writeHead(403).end();

    fs.stat(file, (err, stat) => {
      if (err) file = path.join(root, 'index.html'); // SPA fallback
      else if (stat.isDirectory()) file = path.join(file, 'index.html');
      fs.readFile(file, (readErr, data) => {
        if (readErr) return res.writeHead(404).end('Not found');
        res.writeHead(200, {
          'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
          'Cache-Control': 'no-cache',
        });
        res.end(data);
      });
    });
  })
  .listen(port, () => console.log(`Serving ${root} on http://localhost:${port}`));

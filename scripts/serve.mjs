import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root = resolve('site');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.txt': 'text/plain', '.woff2': 'font/woff2' };
http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let path = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!path.startsWith(root + sep)) { res.writeHead(403).end(); return; }
    if (pathname === '/build') path = resolve(root, 'edit.html');
    try { if (!(await stat(path)).isFile()) throw new Error(); }
    catch {
      if (/^\/[a-z0-9-]+\/?$/.test(pathname)) path = resolve(root, 'u.html');
      else { res.writeHead(404).end('Not found'); return; }
    }
    res.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(await readFile(path));
  } catch { res.writeHead(400).end('Bad request'); }
}).listen(Number(process.env.PORT || 4173), '0.0.0.0', () => console.log('LinkUp: http://localhost:4173'));

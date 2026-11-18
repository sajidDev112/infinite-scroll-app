// One development web server for both front-ends, on a single port:
//   /admin/...   admin dashboard   (Vite, admin/)
//   /client/...  public client site (Vite, client/)
//   /api, /uploads → the API server (default http://localhost:4000)
// Each app keeps its own Vite config; both run in middleware mode inside this server,
// sharing the port for pages and for hot reload.
import http from 'node:http';
import os from 'node:os';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = Number(process.env.WEB_PORT || 5173);
const API = new URL(process.env.API_PROXY_TARGET || 'http://localhost:4000');

/** Load the Vite that belongs to an app folder (admin/ and client/ each have their own). */
async function viteFor(dir) {
  const req = createRequire(path.join(ROOT, dir, 'package.json'));
  return import(pathToFileURL(req.resolve('vite')).href);
}

/** Forward a request to the API, keeping the Host header so image URLs point back here. */
function proxyToApi(req, res) {
  const headers = {
    ...req.headers,
    'x-forwarded-for': [req.headers['x-forwarded-for'], req.socket.remoteAddress].filter(Boolean).join(', '),
    'x-forwarded-proto': 'http',
    'x-forwarded-host': req.headers.host || '',
  };
  const upstream = http.request(
    { hostname: API.hostname === 'localhost' ? '127.0.0.1' : API.hostname, port: API.port || 80, path: req.url, method: req.method, headers },
    (up) => {
      res.writeHead(up.statusCode || 502, up.headers);
      up.pipe(res);
    },
  );
  upstream.on('error', (err) => {
    console.error('[web] API proxy error:', req.method, req.url, err.message);
    if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { message: 'The API server is not reachable. Is it running on ' + API.origin + '?' } }));
  });
  req.pipe(upstream);
}

const server = http.createServer();

const start = async (dir) => {
  const { createServer } = await viteFor(dir);
  return createServer({
    root: path.join(ROOT, dir),
    configFile: path.join(ROOT, dir, 'vite.config.js'),
    appType: 'spa',
    // Hot reload shares this port too (each app on its own base path).
    server: { middlewareMode: true, ws: { server } },
  });
};

const [admin, client] = await Promise.all([start('admin'), start('client')]);

const isPrefix = (url, prefix) => url === prefix || url.startsWith(`${prefix}/`) || url.startsWith(`${prefix}?`);

server.on('request', (req, res) => {
  const url = req.url || '/';
  if (isPrefix(url, '/api') || isPrefix(url, '/uploads')) return proxyToApi(req, res);
  const app = isPrefix(url, '/client') ? client : admin; // admin also redirects "/" and old links
  app.middlewares(req, res, () => {
    res.statusCode = 404;
    res.end('Not found');
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const nets = Object.values(os.networkInterfaces()).flat().filter((n) => n && n.family === 'IPv4' && !n.internal);
  const line = (label, host) => `  ➜ ${label.padEnd(8)} admin  http://${host}:${PORT}/admin/\n` + `  ${' '.repeat(10)} client http://${host}:${PORT}/client/stories`;
  console.log(`\n  Web (admin + client) ready on port ${PORT}\n`);
  console.log(line('Local:', 'localhost'));
  nets.forEach((n) => console.log(line('Network:', n.address)));
  console.log('');
});

const stop = async () => {
  await Promise.allSettled([admin.close(), client.close()]);
  server.close();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

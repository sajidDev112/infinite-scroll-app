import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

const shared = fileURLToPath(new URL('../shared', import.meta.url));

// One address for everything (port 5173):
//   /admin/...   this dashboard
//   /client/...  the public client site (its own Vite server on 5175, forwarded here)
//   /api, /uploads → the API server
// The Host header is kept (no changeOrigin) so image URLs the API builds point back at
// this address, which also makes them work from other devices on the network.
const apiTarget = process.env.API_PROXY_TARGET || 'http://localhost:4000';
const clientTarget = process.env.CLIENT_PROXY_TARGET || 'http://localhost:5175';
const proxy = {
  '/api': { target: apiTarget, xfwd: true },
  '/uploads': { target: apiTarget },
};
const devProxy = {
  ...proxy,
  '/client': { target: clientTarget, ws: true }, // ws: the client's hot reload
};

const SKIP = /^\/(admin|client|api|uploads|@|node_modules|src)(\/|$)/;

/** "/" → /admin/, and old dashboard links like /stories → /admin/stories. */
function legacyRedirects() {
  const handler = (req, res, next) => {
    const url = req.url || '/';
    const path = url.split('?')[0];
    const isPage = req.method === 'GET' && (req.headers.accept || '').includes('text/html');
    if (isPage && !SKIP.test(path)) {
      res.statusCode = 302;
      res.setHeader('Location', path === '/' ? '/admin/' : `/admin${url}`);
      res.end();
      return;
    }
    next();
  };
  return {
    name: 'legacy-redirects',
    configureServer: (server) => { server.middlewares.use(handler); },
    configurePreviewServer: (server) => { server.middlewares.use(handler); },
  };
}

export default defineConfig({
  base: '/admin/',
  plugins: [react(), tailwindcss(), legacyRedirects()],
  resolve: {
    alias: { '@shared': shared },
    // shared/ lives outside this package: resolve its imports from admin/node_modules.
    dedupe: ['react', 'react-dom', 'gsap', 'lenis'],
  },
  // host: true → also reachable from other devices on your network (http://<this-PC-IP>:5173)
  server: { port: 5173, strictPort: true, host: true, fs: { allow: ['..'] }, proxy: devProxy },
  preview: { port: 4173, host: true, proxy },
  build: { chunkSizeWarningLimit: 900 },
});

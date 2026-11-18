import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

const shared = fileURLToPath(new URL('../shared', import.meta.url));

// The site calls /api and /uploads on its own origin; Vite forwards them to the API.
// The Host header is kept (no changeOrigin), so image URLs the API returns point back
// at this site and also work from other devices on the network.
const apiTarget = process.env.API_PROXY_TARGET || 'http://localhost:4000';
const apiProxy = {
  '/api': { target: apiTarget, xfwd: true },
  '/uploads': { target: apiTarget },
};

export default defineConfig({
  // Lives at /client/ (also when opened through the admin address on port 5173).
  base: '/client/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@shared': shared },
    // shared/ lives outside this package: resolve its imports from client/node_modules.
    dedupe: ['react', 'react-dom', 'gsap', 'lenis'],
  },
  // Usually opened through the admin address: http://<this-PC-IP>:5173/client/stories
  // (also works directly on http://<this-PC-IP>:5175/client/stories)
  server: { port: 5175, strictPort: true, host: true, fs: { allow: ['..'] }, proxy: apiProxy },
  preview: { port: 4175, host: true, proxy: apiProxy },
  build: { chunkSizeWarningLimit: 900 },
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const shared = fileURLToPath(new URL('../shared', import.meta.url));
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

// Strict Content-Security-Policy for the packaged app (dev needs inline scripts for HMR).
const csp = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https: http:",
  "font-src 'self' data:",
  "connect-src 'self' https: http:",
  "object-src 'none'",
  "base-uri 'none'",
].join('; ');

export default defineConfig(({ command }) => ({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'inject-csp',
      transformIndexHtml: (html) => (command === 'build'
        ? html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />`)
        : html),
    },
  ],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  resolve: {
    alias: { '@shared': shared },
    dedupe: ['react', 'react-dom', 'gsap', 'lenis'],
  },
  server: { port: 5174, strictPort: true, fs: { allow: ['..'] } },
  build: { outDir: 'dist', emptyOutDir: true, chunkSizeWarningLimit: 900 },
}));

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';

/**
 * In production the API server also serves the two built front-ends, so the whole
 * platform runs at one address (e.g. on Render):
 *   /admin/...   admin dashboard   (admin/dist)
 *   /client/...  public client site (client/dist)
 *   /            → /client/stories
 * In development Vite serves them instead (scripts/dev-web.mjs), and these folders
 * usually don't exist, so nothing is mounted.
 */
const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));

const SITES = [
  { base: '/admin', dir: process.env.ADMIN_DIST || resolve(ROOT, 'admin/dist') },
  { base: '/client', dir: process.env.CLIENT_DIST || resolve(ROOT, 'client/dist') },
];

export function mountWebApps(app) {
  const mounted = [];
  for (const { base, dir } of SITES) {
    const index = resolve(dir, 'index.html');
    if (!existsSync(index)) continue;
    // Hashed build files never change, so cache them for a long time; index.html must
    // always be fresh so a new deploy is picked up right away.
    app.use(base, express.static(dir, {
      index: false,
      setHeaders: (res, file) => {
        if (/[\\/]assets[\\/]/.test(file)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      },
    }));
    // Single-page app: every other page under the base path gets index.html.
    app.get([base, `${base}/*splat`], (req, res, next) => {
      if (req.path.includes('.') && !req.accepts('html')) return next();
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(index);
    });
    mounted.push(base);
  }
  if (mounted.includes('/client')) app.get('/', (_req, res) => res.redirect('/client/stories'));
  else if (mounted.includes('/admin')) app.get('/', (_req, res) => res.redirect('/admin/'));
  return mounted;
}

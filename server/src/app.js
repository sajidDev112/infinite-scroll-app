import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { env, isProd } from './config/env.js';
import { requireAuth, requireRole } from './middleware/auth.js';
import { errorHandler, notFound } from './middleware/error.js';
import authRoutes from './routes/auth.routes.js';
import storyRoutes from './routes/story.routes.js';
import uploadRoutes from './routes/upload.routes.js';
import desktopRoutes from './routes/desktop.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import fontRoutes from './routes/fonts.routes.js';
import { dashboardStats } from './services/storyService.js';
import { countImages } from './services/imageService.js';
import { serveFile } from './services/fileStorage.js';
import { dbReady } from './config/db.js';
import { mountWebApps } from './web.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    // The admin and client sites are served from here in production (see web.js).
    contentSecurityPolicy: {
      directives: {
        'img-src': ["'self'", 'data:', 'blob:', 'https:'], // upload previews
        'media-src': ["'self'", 'data:', 'blob:', 'https:'],
        'font-src': ["'self'", 'data:', 'https:'],
        'connect-src': ["'self'", 'https:'],
      },
    },
  }));
  app.use(compression());
  if (!isProd) app.use(morgan('dev'));

  // Admin API: only the configured dashboard origins.
  const adminCors = cors({
    origin: (origin, cb) => cb(null, !origin || env.corsOrigins.includes(origin)),
    credentials: false,
  });
  // Desktop API is public and read-only; Electron pages have a "null"/file origin.
  const publicCors = cors({ origin: true });

  app.get('/api/health', (_req, res) => res.status(dbReady() ? 200 : 503).json({ ok: dbReady(), db: dbReady() ? 'connected' : 'disconnected', time: new Date().toISOString() }));

  // Uploaded images, read from MongoDB GridFS. File names are unique per image, so cached forever.
  app.get('/uploads/*path', cors({ origin: true }), serveFile);

  app.use('/api/desktop', publicCors, desktopRoutes);
  app.use('/api', adminCors, express.json({ limit: '2mb' }));
  app.use('/api/auth', authRoutes);
  app.use('/api/stories', storyRoutes);
  app.use('/api/uploads', uploadRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/fonts', fontRoutes);
  app.get('/api/dashboard/stats', requireAuth, requireRole('admin', 'editor'), async (_req, res) => {
    const [stats, totalImages] = await Promise.all([dashboardStats(), countImages()]);
    res.json({ ...stats, totals: { ...stats.totals, images: totalImages } });
  });

  mountWebApps(app);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

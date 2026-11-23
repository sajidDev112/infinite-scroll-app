import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { desktopQuerySchema, idParamSchema } from '../validation/schemas.js';
import { getPublishedStory, listPublishedStories } from '../services/storyService.js';
import { absolutizeUrls } from '../services/fileStorage.js';
import { getFooter } from '../services/settingsService.js';
import { listFonts } from '../services/fontService.js';

/** Public, read-only endpoints for the Electron viewer: published + active stories only. */
const router = Router();

router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-cache');
  next();
});

// The desktop app loads from file://, so locally stored image URLs (/uploads/...) are
// made absolute using the address the app used to reach this server (or PUBLIC_URL).
const origin = (req) => (process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');

router.get('/stories', validate(desktopQuerySchema, 'query'), async (req, res) => {
  res.json(absolutizeUrls(await listPublishedStories(req.valid.query), origin(req)));
});

router.get('/stories/:id', validate(idParamSchema, 'params'), async (req, res) => {
  res.json({ story: absolutizeUrls(await getPublishedStory(req.valid.params.id), origin(req)) });
});

/** The intro footer (share buttons, logo, name) for the client site and desktop app. */
router.get('/settings', async (req, res) => {
  res.json({ footer: absolutizeUrls(await getFooter(), origin(req)) });
});

/** Fonts uploaded in admin Settings, for story text. */
router.get('/fonts', async (req, res) => {
  res.json({ fonts: absolutizeUrls(await listFonts(), origin(req)) });
});

export default router;

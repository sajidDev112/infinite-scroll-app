import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { footerSchema } from '../validation/schemas.js';
import { getFooter, resetFooter, updateFooter } from '../services/settingsService.js';

/** Site-wide settings for the dashboard. Editors can read; only admins can change them. */
const router = Router();
router.use(requireAuth, requireRole('admin', 'editor'));

router.get('/footer', async (_req, res) => {
  res.json({ footer: await getFooter() });
});

router.put('/footer', requireRole('admin'), validate(footerSchema), async (req, res) => {
  res.json({ footer: await updateFooter(req.valid.body, req.admin) });
});

router.delete('/footer', requireRole('admin'), async (req, res) => {
  res.json({ footer: await resetFooter(req.admin) });
});

export default router;

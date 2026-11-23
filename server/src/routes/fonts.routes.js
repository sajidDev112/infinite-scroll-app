import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { fontUpload } from '../middleware/upload.js';
import { validate } from '../middleware/validate.js';
import { idParamSchema } from '../validation/schemas.js';
import { addFontFiles, deleteFont, deleteFontFile, listFonts } from '../services/fontService.js';
import { FONT_WEIGHT_OPTIONS } from '../../../shared/engine/fonts.js';
import { ApiError } from '../utils/errors.js';

/** Uploaded fonts (Settings → Fonts). Editors can list them; only admins can change them. */
const router = Router();
router.use(requireAuth, requireRole('admin', 'editor'));

const variantsSchema = z.array(z.object({
  weight: z.number().refine((w) => FONT_WEIGHT_OPTIONS.includes(w), 'Weight must be 100, 200, … 900.'),
  style: z.enum(['normal', 'italic']),
})).max(20);

router.get('/', async (_req, res) => {
  res.json({ fonts: await listFonts({ withUsage: true }) });
});

/**
 * multipart/form-data: "family" (name), "files" (one or more font files) and
 * "variants" (JSON: [{ weight, style }] in the same order as the files).
 */
router.post('/', requireRole('admin'), fontUpload.array('files', 20), async (req, res) => {
  let variants;
  try {
    variants = variantsSchema.parse(JSON.parse(req.body?.variants || '[]'));
  } catch {
    throw ApiError.badRequest('Each font file needs a weight (100–900) and a style (normal or italic).');
  }
  const font = await addFontFiles({ family: req.body?.family, files: req.files, variants }, req.admin);
  res.status(201).json({ font });
});

const fileParams = idParamSchema.extend({ key: z.string().regex(/^[1-9]00-(normal|italic)$/, 'Invalid weight.') });

router.delete('/:id/files/:key', requireRole('admin'), validate(fileParams, 'params'), async (req, res) => {
  res.json({ font: await deleteFontFile(req.valid.params.id, req.valid.params.key) });
});

router.delete('/:id', requireRole('admin'), validate(idParamSchema, 'params'), async (req, res) => {
  await deleteFont(req.valid.params.id);
  res.status(204).end();
});

export default router;

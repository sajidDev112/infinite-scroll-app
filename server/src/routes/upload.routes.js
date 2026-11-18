import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { imageUpload } from '../middleware/upload.js';
import { validate } from '../middleware/validate.js';
import { idParamSchema } from '../validation/schemas.js';
import { deleteImage, processAndStoreImage } from '../services/imageService.js';
import { ApiError } from '../utils/errors.js';

const router = Router();
router.use(requireAuth, requireRole('admin', 'editor'));

/** multipart/form-data, field "images" (one or more files). */
router.post('/images', imageUpload.array('images', 20), async (req, res) => {
  if (!req.files?.length) throw ApiError.badRequest('Attach at least one image in the "images" field.');
  const images = [];
  // Sequential keeps memory bounded when several large files arrive at once.
  for (const file of req.files) images.push(await processAndStoreImage(file, req.admin.id));
  res.status(201).json({ images });
});

router.delete('/:id', validate(idParamSchema, 'params'), async (req, res) => {
  await deleteImage(req.valid.params.id);
  res.status(204).end();
});

export default router;

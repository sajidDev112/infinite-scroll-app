import multer from 'multer';
import { env } from '../config/env.js';
import { ApiError } from '../utils/errors.js';

export const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];

/** Files stay in memory only long enough for sharp to re-encode them. */
export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxUploadMb * 1024 * 1024, files: 20 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      cb(ApiError.badRequest(`${file.originalname}: only JPG, PNG and WebP images are allowed.`));
      return;
    }
    cb(null, true);
  },
});

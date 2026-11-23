import multer from 'multer';
import { env } from '../config/env.js';
import { ApiError } from '../utils/errors.js';

/** Font files (WOFF2, WOFF, TTF, OTF); the content is checked in fontService. */
export const fontUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 20 },
  fileFilter: (_req, file, cb) => {
    if (!/\.(woff2?|ttf|otf)$/i.test(file.originalname)) {
      cb(ApiError.badRequest(`${file.originalname}: only WOFF2, WOFF, TTF and OTF font files are allowed.`));
      return;
    }
    cb(null, true);
  },
});

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

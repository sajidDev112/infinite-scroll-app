import multer from 'multer';
import { isProd } from '../config/env.js';
import { ApiError } from '../utils/errors.js';

export function notFound(req, _res, next) {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found.`));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  let status = err.status || err.statusCode || 500;
  let message = err.message || 'Something went wrong.';
  let details = err.details;

  if (err instanceof multer.MulterError) {
    status = 400;
    message = err.code === 'LIMIT_FILE_SIZE' ? 'Image is too large.' : `Upload error: ${err.message}`;
  } else if (err.type === 'entity.too.large') {
    status = 413;
    message = 'Request body is too large.';
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Malformed JSON body.';
  }

  if (status >= 500) {
    console.error(`[error] ${req.method} ${req.originalUrl}`, err);
    if (isProd && !(err instanceof ApiError)) {
      message = 'Internal server error.';
      details = undefined;
    }
  }
  res.status(status).json({ error: { message, ...(details ? { details } : {}) } });
}

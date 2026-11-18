import { ApiError } from '../utils/errors.js';

/** Validates req[source] with a zod schema and replaces it with the parsed value. */
export const validate = (schema, source = 'body') => (req, _res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    const details = result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    throw ApiError.badRequest('Validation failed.', details);
  }
  // req.query is a getter in Express 5, so store parsed values separately.
  req.valid = { ...(req.valid || {}), [source]: result.data };
  next();
};

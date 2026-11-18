import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ApiError } from '../utils/errors.js';
import { findAdminById } from '../services/adminService.js';

export function signToken(admin, remember = false) {
  return jwt.sign({ sub: admin.id, role: admin.role }, env.jwtSecret, {
    expiresIn: remember ? env.jwtRememberExpiresIn : env.jwtExpiresIn,
  });
}

/** Verifies the Bearer JWT and loads the admin (so deleted admins lose access at once). */
export async function requireAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) throw ApiError.unauthorized();
  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch (err) {
    throw ApiError.unauthorized(err.name === 'TokenExpiredError' ? 'Session expired. Please sign in again.' : 'Invalid session.');
  }
  const admin = await findAdminById(payload.sub);
  if (!admin) throw ApiError.unauthorized('Account no longer exists.');
  req.admin = admin;
  next();
}

export const requireRole = (...roles) => (req, _res, next) => {
  if (!req.admin || !roles.includes(req.admin.role)) throw ApiError.forbidden();
  next();
};

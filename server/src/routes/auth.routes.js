import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth, signToken } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { loginSchema, passwordSchema, profileSchema } from '../validation/schemas.js';
import { changePassword, publicAdmin, updateProfile, verifyCredentials } from '../services/adminService.js';
import { ApiError } from '../utils/errors.js';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { message: 'Too many sign-in attempts. Try again in a few minutes.' } },
});

router.post('/login', loginLimiter, validate(loginSchema), async (req, res) => {
  const { email, password, remember } = req.valid.body;
  const admin = await verifyCredentials(email, password);
  if (!admin) throw ApiError.unauthorized('Incorrect email or password.');
  res.json({ token: signToken(admin, remember), admin: publicAdmin(admin) });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ admin: publicAdmin(req.admin) });
});

router.patch('/me', requireAuth, validate(profileSchema), async (req, res) => {
  const admin = await updateProfile(req.admin.id, req.valid.body);
  res.json({ admin: publicAdmin(admin) });
});

router.post('/change-password', requireAuth, validate(passwordSchema), async (req, res) => {
  const { currentPassword, newPassword } = req.valid.body;
  await changePassword(req.admin.id, currentPassword, newPassword);
  res.json({ message: 'Password updated.' });
});

export default router;

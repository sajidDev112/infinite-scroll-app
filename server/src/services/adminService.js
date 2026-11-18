import bcrypt from 'bcryptjs';
import { COLLECTIONS, getDb } from '../config/firebase.js';
import { ApiError } from '../utils/errors.js';
import { now, plain } from '../utils/serialize.js';

const ROUNDS = 12;
export const ROLES = ['admin', 'editor'];

const col = () => getDb().collection(COLLECTIONS.admins);

/** Public shape — never includes the password hash. */
export function publicAdmin(admin) {
  if (!admin) return null;
  const { passwordHash, ...rest } = admin;
  return plain(rest);
}

export async function findAdminById(id) {
  if (!id) return null;
  const doc = await col().doc(String(id)).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

export async function findAdminByEmail(email) {
  const snap = await col().where('email', '==', String(email).toLowerCase()).limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...doc.data() };
}

export async function createAdmin({ name, email, password, role = 'admin' }) {
  if (!ROLES.includes(role)) throw ApiError.badRequest(`Role must be one of: ${ROLES.join(', ')}`);
  const normalized = String(email).trim().toLowerCase();
  if (await findAdminByEmail(normalized)) throw ApiError.conflict('An admin with this email already exists.');
  const ts = now();
  const data = {
    name: String(name).trim(),
    email: normalized,
    passwordHash: await bcrypt.hash(password, ROUNDS),
    role,
    createdAt: ts,
    updatedAt: ts,
    lastLoginAt: null,
  };
  const ref = await col().add(data);
  return { id: ref.id, ...data };
}

/**
 * Creates the admin from ADMIN_EMAIL / ADMIN_PASSWORD (.env) if that email has no account yet.
 * An existing account is never changed, so a password changed in Settings stays changed.
 */
export async function ensureBootstrapAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return null;
  if (password.length < 8) throw new Error('ADMIN_PASSWORD must be at least 8 characters.');
  if (await findAdminByEmail(email)) return { created: false, email };
  await createAdmin({ name: process.env.ADMIN_NAME || 'Administrator', email, password, role: 'admin' });
  return { created: true, email };
}

// Constant-time-ish failure path: compare against a dummy hash when the user doesn't exist.
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', 10);

export async function verifyCredentials(email, password) {
  const admin = await findAdminByEmail(email);
  const ok = await bcrypt.compare(password, admin?.passwordHash || DUMMY_HASH);
  if (!admin || !ok) return null;
  await col().doc(admin.id).update({ lastLoginAt: now() });
  return admin;
}

export async function updateProfile(id, { name }) {
  await col().doc(id).update({ name, updatedAt: now() });
  return findAdminById(id);
}

export async function changePassword(id, currentPassword, newPassword) {
  const admin = await findAdminById(id);
  if (!admin) throw ApiError.notFound('Admin not found.');
  const ok = await bcrypt.compare(currentPassword, admin.passwordHash);
  if (!ok) throw ApiError.badRequest('Current password is incorrect.', [{ path: 'currentPassword', message: 'Current password is incorrect.' }]);
  await col().doc(id).update({ passwordHash: await bcrypt.hash(newPassword, ROUNDS), updatedAt: now() });
}

import { existsSync } from 'node:fs';

/** Render "Secret Files" are mounted here; used automatically when present. */
const RENDER_SECRET_FILE = '/etc/secrets/serviceAccount.json';

const list = (v, fallback) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : fallback);

/**
 * Accepts the Firebase private key however a hosting dashboard (e.g. Render) received it:
 * wrapped in quotes, with literal "\n" sequences, real line breaks, Windows line breaks,
 * line breaks collapsed into spaces, base64-encoded, or the whole service-account JSON.
 * Returns a clean PEM string.
 */
export function normalizePrivateKey(raw) {
  let key = String(raw || '').trim();
  if (!key) return '';
  if (key.startsWith('{')) {
    try { key = JSON.parse(key).private_key || ''; } catch { /* not JSON, keep going */ }
  }
  // Surrounding quotes copied from a .env file.
  while (key.length > 1 && /^["']/.test(key) && key.endsWith(key[0])) key = key.slice(1, -1).trim();
  key = key.replace(/\\r/g, '').replace(/\\n/g, '\n').replace(/\r/g, '');
  if (!key.includes('-----BEGIN')) {
    try {
      const decoded = Buffer.from(key, 'base64').toString('utf8');
      if (decoded.includes('-----BEGIN')) key = decoded.trim();
    } catch { /* not base64 */ }
  }
  // Rebuild the PEM so stray spaces/line breaks inside the body don't matter.
  const m = key.match(/-----BEGIN ([A-Z ]+)-----([\s\S]*?)-----END \1-----/);
  if (!m) return key;
  const body = m[2].replace(/[^A-Za-z0-9+/=]/g, '');
  return `-----BEGIN ${m[1]}-----\n${body.match(/.{1,64}/g).join('\n')}\n-----END ${m[1]}-----\n`;
}

/** Whole service-account JSON in one variable (FIREBASE_SERVICE_ACCOUNT_JSON). */
function serviceAccountJson() {
  const raw = (process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim();
  if (!raw) return {};
  try {
    const text = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
    const j = JSON.parse(text);
    return { projectId: j.project_id, clientEmail: j.client_email, privateKey: j.private_key };
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON (paste the whole service-account file).');
  }
}
const sa = serviceAccountJson();

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  // API_PORT wins over a generic PORT that a shell or tool may set for something else;
  // hosting platforms that only provide PORT still work.
  port: Number(process.env.API_PORT || process.env.PORT) || 4000,
  jwtSecret: process.env.JWT_SECRET || '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '12h',
  jwtRememberExpiresIn: process.env.JWT_REMEMBER_EXPIRES_IN || '30d',
  corsOrigins: list(process.env.CORS_ORIGINS, ['http://localhost:5173']),
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB) || 15,
  // 'local' → images saved in UPLOADS_DIR and served by this server; 'firebase' → Firebase Storage.
  storageDriver: (process.env.STORAGE_DRIVER || 'local').toLowerCase(),
  uploadsDir: process.env.UPLOADS_DIR || 'uploads',
  firebase: {
    // Order: explicit path → Render secret file → FIREBASE_SERVICE_ACCOUNT_JSON → the three inline values.
    serviceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH || (existsSync(RENDER_SECRET_FILE) ? RENDER_SECRET_FILE : ''),
    projectId: (sa.projectId || process.env.FIREBASE_PROJECT_ID || '').trim().replace(/^["']|["']$/g, ''),
    clientEmail: (sa.clientEmail || process.env.FIREBASE_CLIENT_EMAIL || '').trim().replace(/^["']|["']$/g, ''),
    privateKey: normalizePrivateKey(sa.privateKey || process.env.FIREBASE_PRIVATE_KEY),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
  },
};

export const isProd = env.nodeEnv === 'production';

/** Fail fast with a readable message instead of a cryptic SDK error later. */
export function assertEnv() {
  const problems = [];
  if (!env.jwtSecret || env.jwtSecret.length < 32) problems.push('JWT_SECRET must be set (at least 32 characters).');
  const f = env.firebase;
  const hasInline = f.projectId && f.clientEmail && f.privateKey;
  if (!f.serviceAccountPath && !hasInline && !process.env.FIRESTORE_EMULATOR_HOST) {
    problems.push('Set FIREBASE_SERVICE_ACCOUNT_JSON, FIREBASE_SERVICE_ACCOUNT_PATH, or FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY.');
  }
  if (!f.serviceAccountPath && f.privateKey && !/^-----BEGIN [A-Z ]*PRIVATE KEY-----\n[A-Za-z0-9+/=\n]+\n-----END [A-Z ]*PRIVATE KEY-----\n$/.test(f.privateKey)) {
    // Describe what arrived without printing any of the secret.
    const raw = String(process.env.FIREBASE_PRIVATE_KEY || '');
    problems.push(
      'FIREBASE_PRIVATE_KEY is not a complete private key. Paste the whole "private_key" value from the service-account JSON, '
      + 'from -----BEGIN PRIVATE KEY----- to -----END PRIVATE KEY----- (a full key is about 1,700 characters). '
      + `Received: ${raw.length} characters, ${raw.split(/\r?\n/).length} line(s), `
      + `BEGIN line ${raw.includes('-----BEGIN') ? 'found' : 'missing'}, END line ${raw.includes('-----END') ? 'found' : 'missing'}. `
      + 'Easiest fix on Render: add a Secret File named serviceAccount.json instead.',
    );
  }
  if (!['local', 'firebase'].includes(env.storageDriver)) problems.push("STORAGE_DRIVER must be 'local' or 'firebase'.");
  if (env.storageDriver === 'firebase' && !f.storageBucket) {
    problems.push('FIREBASE_STORAGE_BUCKET must be set when STORAGE_DRIVER=firebase (e.g. my-project.firebasestorage.app).');
  }
  if (problems.length) {
    const msg = `Server configuration error:\n  - ${problems.join('\n  - ')}\nSee server/.env.example.`;
    throw new Error(msg);
  }
}

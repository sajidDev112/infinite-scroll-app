const list = (v, fallback) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : fallback);

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
    serviceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH || '',
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
    privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
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
    problems.push('Set FIREBASE_SERVICE_ACCOUNT_PATH, or FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY.');
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

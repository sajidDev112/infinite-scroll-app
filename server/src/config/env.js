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
  // MongoDB holds everything: admins, stories, published snapshots and (in GridFS) the image files.
  mongoUri: (process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/infinite_scroll_app').trim(),
};

export const isProd = env.nodeEnv === 'production';

/** Fail fast with a readable message instead of a cryptic error later. */
export function assertEnv() {
  const problems = [];
  if (!env.jwtSecret || env.jwtSecret.length < 32) problems.push('JWT_SECRET must be set (at least 32 characters).');
  if (!/^mongodb(\+srv)?:\/\//.test(env.mongoUri)) problems.push('MONGODB_URI must start with mongodb:// or mongodb+srv://');
  if (problems.length) {
    const msg = `Server configuration error:\n  - ${problems.join('\n  - ')}\nSee server/.env.example.`;
    throw new Error(msg);
  }
}

import { assertEnv, env } from './config/env.js';
import { connectDb, disconnectDb } from './config/db.js';
import { createApp } from './app.js';
import { ensureBootstrapAdmin } from './services/adminService.js';

try {
  assertEnv();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

try {
  await connectDb();
  // Never print the URI itself: it may contain a password.
  console.log(`MongoDB connected (database "${(await import('mongoose')).default.connection.name}")`);
} catch (err) {
  console.error(`Could not connect to MongoDB: ${err.message}\nIs MongoDB running, and is MONGODB_URI correct?`);
  process.exit(1);
}

try {
  const seeded = await ensureBootstrapAdmin();
  if (seeded?.created) console.log(`Created admin account ${seeded.email} from .env`);
} catch (err) {
  console.error(`Could not create the admin from .env: ${err.message}`);
}

const server = createApp().listen(env.port, () => {
  console.log(`Story API listening on http://localhost:${env.port} (${env.nodeEnv})`);
});

const shutdown = () => server.close(async () => {
  await disconnectDb().catch(() => {});
  process.exit(0);
});
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

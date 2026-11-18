import { assertEnv, env } from './config/env.js';
import { initFirebase } from './config/firebase.js';
import { createApp } from './app.js';
import { ensureBootstrapAdmin } from './services/adminService.js';

try {
  assertEnv();
  initFirebase();
} catch (err) {
  console.error(err.message);
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

const shutdown = () => server.close(() => process.exit(0));
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

/**
 * Creates a dashboard admin in Firestore.
 *   npm run create-admin -- --email you@example.com --password "s3cret-pass" --name "Your Name" [--role admin|editor]
 */
import { parseArgs } from 'node:util';
import { assertEnv } from '../src/config/env.js';
import { initFirebase } from '../src/config/firebase.js';
import { createAdmin } from '../src/services/adminService.js';

const { values } = parseArgs({
  options: {
    email: { type: 'string' },
    password: { type: 'string' },
    name: { type: 'string', default: 'Administrator' },
    role: { type: 'string', default: 'admin' },
  },
});

if (!values.email || !values.password) {
  console.error('Usage: npm run create-admin -- --email you@example.com --password "min-8-chars" [--name "Name"] [--role admin|editor]');
  process.exit(1);
}
if (values.password.length < 8) {
  console.error('Password must be at least 8 characters.');
  process.exit(1);
}

try {
  assertEnv();
  initFirebase();
  const admin = await createAdmin(values);
  console.log(`Created ${admin.role} ${admin.email} (id ${admin.id}).`);
  process.exit(0);
} catch (err) {
  console.error(`Could not create admin: ${err.message}`);
  process.exit(1);
}

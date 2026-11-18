/**
 * TEST-ONLY launcher: runs the real Express app against the in-memory Firestore /
 * Storage stand-in, so the dashboard and desktop app can be exercised without
 * Firebase credentials. Data is lost when the process exits.
 *
 *   node test/fake-server.js        (admin: admin@example.com / password123)
 */
import { createFakeBucket, createFakeDb } from './fakeFirebase.js';

const PORT = Number(process.env.PORT) || 4000;
process.env.JWT_SECRET ||= 'local-test-secret-local-test-secret-123456';
process.env.CORS_ORIGINS ||= 'http://localhost:5173';
process.env.STORAGE_DRIVER = 'firebase';
// Makes image URLs point back at this process instead of firebasestorage.googleapis.com.
process.env.FIREBASE_STORAGE_EMULATOR_HOST = `localhost:${PORT}`;

const { __setFirebase } = await import('../src/config/firebase.js');
const bucket = createFakeBucket();
__setFirebase({ db: createFakeDb(), bucket });

const { createApp } = await import('../src/app.js');
const { createAdmin } = await import('../src/services/adminService.js');
await createAdmin({ name: 'Test Admin', email: 'admin@example.com', password: 'password123', role: 'admin' });

const app = createApp();
// Serve stored objects the way the Storage download endpoint would (mounted ahead of the API's 404).
const express = (await import('express')).default;
const outer = express();
outer.get('/v0/b/:bucket/o/:path', (req, res) => {
  const file = bucket.files.get(decodeURIComponent(req.params.path));
  if (!file) return res.status(404).end();
  res.set({ 'Content-Type': 'image/webp', 'Cache-Control': 'public, max-age=3600', 'Access-Control-Allow-Origin': '*', 'Cross-Origin-Resource-Policy': 'cross-origin' });
  return res.send(file.buf);
});
outer.use(app);
outer.listen(PORT, () => console.log(`[fake] Story API on http://localhost:${PORT} — admin@example.com / password123`));

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { createFakeDb } from './fakeFirebase.js';

const dir = mkdtempSync(join(tmpdir(), 'sf-uploads-'));
process.env.JWT_SECRET = 'test-secret-that-is-definitely-longer-than-32-chars';
process.env.NODE_ENV = 'test';
process.env.STORAGE_DRIVER = 'local';
process.env.UPLOADS_DIR = dir;

const { __setFirebase } = await import('../src/config/firebase.js');
__setFirebase({ db: createFakeDb(), bucket: null });
const { createApp } = await import('../src/app.js');
const { createAdmin } = await import('../src/services/adminService.js');
const { createScene } = await import('../../shared/engine/defaults.js');

let server;
let base;
let token;
const json = (method, path, body) => fetch(base + path, {
  method,
  headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
  body: body ? JSON.stringify(body) : undefined,
}).then(async (r) => ({ status: r.status, body: r.status === 204 ? null : await r.json() }));

before(async () => {
  server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
  await createAdmin({ name: 'A', email: 'a@example.com', password: 'password123' });
  const login = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'a@example.com', password: 'password123' }) });
  token = (await login.json()).token;
});
after(() => {
  server.close();
  rmSync(dir, { recursive: true, force: true });
});

test('local driver: upload saves to disk, serves it, desktop gets absolute URLs, delete cleans up', async () => {
  const png = await sharp({ create: { width: 1200, height: 800, channels: 3, background: '#224488' } }).png().toBuffer();
  const form = new FormData();
  form.append('images', new Blob([png], { type: 'image/png' }), 'a.png');
  const up = await fetch(`${base}/api/uploads/images`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
  assert.equal(up.status, 201);
  const [img] = (await up.json()).images;
  assert.match(img.url, /^\/uploads\/story-images\/[^/]+\/full\.webp$/);
  assert.ok(existsSync(join(dir, 'story-images', img.id, 'full.webp')));

  const served = await fetch(base + img.thumbUrl);
  assert.equal(served.status, 200);
  assert.equal(served.headers.get('content-type'), 'image/webp');
  assert.equal((await fetch(`${base}/uploads/../package.json`)).status, 404);

  const created = await json('POST', '/api/stories', { title: 'Local', scenes: [createScene(img)] });
  const id = created.body.story.id;
  assert.equal((await json('POST', `/api/stories/${id}/publish`)).status, 200);
  const desk = await fetch(`${base}/api/desktop/stories/${id}`).then((r) => r.json());
  assert.equal(desk.story.scenes[0].imageUrl, `${base}${img.url}`);

  assert.equal((await json('DELETE', `/api/stories/${id}`)).status, 204);
  assert.ok(!existsSync(join(dir, 'story-images', img.id, 'full.webp')), 'file removed with the story');
});

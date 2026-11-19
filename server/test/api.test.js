import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';

process.env.JWT_SECRET = 'test-secret-that-is-definitely-longer-than-32-chars';
process.env.NODE_ENV = 'test';
// A throw-away database on the local MongoDB, dropped when the suite ends.
const DB_NAME = `story_platform_test_${process.pid}`;
const mongoose = (await import('mongoose')).default;
const { connectDb, disconnectDb } = await import('../src/config/db.js');
const MONGO = (process.env.MONGODB_TEST_URI || 'mongodb://127.0.0.1:27017').replace(/\/$/, '');
await connectDb(`${MONGO}/${DB_NAME}`);
const storedFiles = () => mongoose.connection.db.collection('images.files').countDocuments();
const { createApp } = await import('../src/app.js');
const { createAdmin } = await import('../src/services/adminService.js');
const { createScene, createTextElement } = await import('../../shared/engine/defaults.js');

let server;
let base;
let token;
let editorToken;

const api = async (method, path, { body, auth = token, form } = {}) => {
  const headers = {};
  if (auth) headers.Authorization = `Bearer ${auth}`;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(base + path, { method, headers, body: form || (body ? JSON.stringify(body) : undefined) });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
};

const pngBuffer = (w, h) => sharp({ create: { width: w, height: h, channels: 3, background: '#3355aa' } }).png().toBuffer();

async function upload(buffer, name = 'photo.png', type = 'image/png') {
  const form = new FormData();
  form.append('images', new Blob([buffer], { type }), name);
  return api('POST', '/api/uploads/images', { form });
}

before(async () => {
  server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
  await createAdmin({ name: 'Ada', email: 'Ada@Example.com', password: 'correct-horse', role: 'admin' });
  await createAdmin({ name: 'Ed', email: 'ed@example.com', password: 'editor-pass', role: 'editor' });
});
after(async () => {
  server.close();
  await mongoose.connection.db.dropDatabase();
  await disconnectDb();
});

test('health check', async () => {
  const r = await api('GET', '/api/health', { auth: null });
  assert.equal(r.status, 200);
});

test('login validates input and credentials', async () => {
  assert.equal((await api('POST', '/api/auth/login', { auth: null, body: { email: 'nope', password: '' } })).status, 400);
  assert.equal((await api('POST', '/api/auth/login', { auth: null, body: { email: 'ada@example.com', password: 'wrong' } })).status, 401);
  const ok = await api('POST', '/api/auth/login', { auth: null, body: { email: 'ADA@example.com', password: 'correct-horse', remember: true } });
  assert.equal(ok.status, 200);
  assert.ok(ok.body.token);
  assert.equal(ok.body.admin.passwordHash, undefined);
  token = ok.body.token;
  editorToken = (await api('POST', '/api/auth/login', { auth: null, body: { email: 'ed@example.com', password: 'editor-pass' } })).body.token;
});

test('protected routes require a valid token', async () => {
  assert.equal((await api('GET', '/api/stories', { auth: null })).status, 401);
  assert.equal((await api('GET', '/api/stories', { auth: 'garbage' })).status, 401);
  const me = await api('GET', '/api/auth/me');
  assert.equal(me.body.admin.email, 'ada@example.com');
});

let img;
test('image upload: resized, re-encoded, stored with thumbnail', async () => {
  const r = await upload(await pngBuffer(5000, 2500));
  assert.equal(r.status, 201, JSON.stringify(r.body));
  [img] = r.body.images;
  assert.equal(img.width, 3840);
  assert.equal(img.height, 1920);
  assert.match(img.url, /^\/uploads\/story-images\/[A-Za-z0-9]{20}\/full\.webp$/);
  assert.equal(await storedFiles(), 2);
  const file = await fetch(base + img.url);
  assert.equal(file.status, 200);
  assert.equal(file.headers.get('content-type'), 'image/webp');
  assert.equal((await fetch(base + '/uploads/story-images/nope/full.webp')).status, 404);
});

test('image upload rejects spoofed and disallowed files', async () => {
  assert.equal((await upload(Buffer.from('not an image'), 'evil.png')).status, 400);
  assert.equal((await upload(Buffer.from('GIF89a'), 'a.gif', 'image/gif')).status, 400);
});

let storyId;
test('story create, list, search and status rules', async () => {
  const scene = createScene(img);
  scene.animationSteps[1].zoomLevel = 2.5;
  scene.animationSteps[1].textElements = [createTextElement({ content: 'Hello' })];

  assert.equal((await api('POST', '/api/stories', { body: { title: 'X', status: 'active' } })).status, 409);
  assert.equal((await api('POST', '/api/stories', { body: { title: '' } })).status, 400);

  const r = await api('POST', '/api/stories', { body: { title: 'The Lighthouse', description: 'Storm night', scenes: [scene] } });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  storyId = r.body.story.id;
  assert.equal(r.body.story.sceneCount, 1);
  assert.deepEqual(r.body.story.imageIds, [img.id]);

  await api('POST', '/api/stories', { body: { title: 'Empty one' } });
  const list = await api('GET', '/api/stories?search=light&status=draft');
  assert.equal(list.body.items.length, 1);
  assert.equal(list.body.items[0].scenes, undefined, 'list returns summaries only');
  assert.equal(list.body.counts.all, 2);

  const activate = await api('PATCH', `/api/stories/${storyId}/status`, { body: { status: 'active' } });
  assert.equal(activate.status, 409);
});

test('publish validates, snapshots, and desktop only sees published+active', async () => {
  const empty = (await api('GET', '/api/stories?search=empty')).body.items[0];
  const bad = await api('POST', `/api/stories/${empty.id}/publish`);
  assert.equal(bad.status, 422);
  assert.ok(bad.body.error.details.length > 0);

  assert.equal((await api('GET', '/api/desktop/stories', { auth: null })).body.items.length, 0);
  assert.equal((await api('POST', `/api/stories/${storyId}/publish`, { auth: editorToken })).status, 403);
  const pub = await api('POST', `/api/stories/${storyId}/publish`);
  assert.equal(pub.status, 200, JSON.stringify(pub.body));
  assert.equal(pub.body.story.status, 'active');

  const list = await api('GET', '/api/desktop/stories', { auth: null });
  assert.equal(list.body.items.length, 1);
  const detail = await api('GET', `/api/desktop/stories/${storyId}`, { auth: null });
  assert.equal(detail.body.story.scenes[0].animationSteps[1].zoomLevel, 2.5);
  assert.equal(detail.body.story.imageIds, undefined);

  // Editing the working copy does not change the live story until re-published.
  const upd = await api('PUT', `/api/stories/${storyId}`, { body: { title: 'The Lighthouse (edited)' } });
  assert.equal(upd.body.story.hasUnpublishedChanges, true);
  assert.equal((await api('GET', `/api/desktop/stories/${storyId}`, { auth: null })).body.story.title, 'The Lighthouse');

  await api('PATCH', `/api/stories/${storyId}/status`, { body: { status: 'inactive' } });
  assert.equal((await api('GET', '/api/desktop/stories', { auth: null })).body.items.length, 0);
  assert.equal((await api('GET', `/api/desktop/stories/${storyId}`, { auth: null })).status, 404);
  await api('PATCH', `/api/stories/${storyId}/status`, { body: { status: 'active' } });
  assert.equal((await api('GET', '/api/desktop/stories', { auth: null })).body.items.length, 1);
});

test('dashboard stats', async () => {
  const r = await api('GET', '/api/dashboard/stats');
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.totals, { total: 2, active: 1, inactive: 0, draft: 1, live: 1, images: 1 });
  assert.equal(r.body.recentStories.length, 2);
});

test('image refcounting across duplicate and delete', async () => {
  assert.equal((await api('DELETE', `/api/uploads/${img.id}`)).status, 409);
  const dup = await api('POST', `/api/stories/${storyId}/duplicate`);
  assert.equal(dup.status, 201);
  assert.equal(dup.body.story.status, 'draft');

  assert.equal((await api('DELETE', `/api/stories/${storyId}`, { auth: editorToken })).status, 403);
  assert.equal((await api('DELETE', `/api/stories/${storyId}`)).status, 204);
  assert.equal(await storedFiles(), 2, 'duplicate still uses the image');
  assert.equal((await api('GET', `/api/desktop/stories/${storyId}`, { auth: null })).status, 404);

  assert.equal((await api('DELETE', `/api/stories/${dup.body.story.id}`)).status, 204);
  assert.equal(await storedFiles(), 0, 'orphaned image removed from storage');
});

test('unknown routes and bad ids', async () => {
  assert.equal((await api('GET', '/api/nope')).status, 404);
  assert.equal((await api('GET', '/api/stories/bad$id')).status, 400);
  assert.equal((await api('GET', '/api/stories/doesnotexist')).status, 404);
});

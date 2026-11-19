/**
 * One-time import of the old Firebase data into MongoDB:
 *   Firestore admins, stories, publishedStories, images  →  MongoDB collections (same ids)
 *   image files (Firestore "fileBlobs", or server/uploads)  →  MongoDB GridFS
 * Image links stay /uploads/..., so stories need no changes. Safe to run again:
 * documents are replaced by id, files by path.
 *
 *   npm run import-from-firebase -- --key ./serviceAccount.json [--uploads ./uploads]
 * Needs the dev dependency firebase-admin (npm install in server/).
 */
import { existsSync, readFileSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { env } from '../src/config/env.js';
import { connectDb, disconnectDb } from '../src/config/db.js';
import { Admin, Image, PublishedStory, Story } from '../src/models/index.js';
import { getFile, putFile } from '../src/services/fileStorage.js';

const { values } = parseArgs({
  options: {
    key: { type: 'string', default: './serviceAccount.json' },
    uploads: { type: 'string', default: './uploads' },
  },
});
const keyPath = resolve(values.key);
if (!existsSync(keyPath)) {
  console.error(`Service-account file not found: ${keyPath}\nPass it with --key <path-to-firebase-key.json>.`);
  process.exit(1);
}

const { cert, initializeApp } = await import('firebase-admin/app');
const { getFirestore } = await import('firebase-admin/firestore');
const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));
const firestore = getFirestore(initializeApp({ credential: cert(serviceAccount) }));
console.log(`Reading Firebase project "${serviceAccount.project_id}"`);

await connectDb(env.mongoUri);
console.log('Writing to MongoDB database:', (await import('mongoose')).default.connection.name);

/** Firestore Timestamps → Dates, recursively; everything else unchanged. */
function toMongo(value) {
  if (value && typeof value.toDate === 'function' && typeof value.seconds === 'number') return value.toDate();
  if (Array.isArray(value)) return value.map(toMongo);
  if (value && typeof value === 'object' && !Buffer.isBuffer(value)) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toMongo(v)]));
  }
  return value;
}

// 1. Documents (raw collection writes keep every field exactly as it was).
for (const [name, Model] of [['admins', Admin], ['stories', Story], ['publishedStories', PublishedStory], ['images', Image]]) {
  const snap = await firestore.collection(name).get();
  for (const doc of snap.docs) {
    // The Firebase admin wins over one the server may already have created from .env
    // (same email, new id): it keeps its id and any password changed in Settings.
    if (name === 'admins') await Model.collection.deleteMany({ email: doc.get('email'), _id: { $ne: doc.id } });
    await Model.collection.replaceOne({ _id: doc.id }, { ...toMongo(doc.data()), _id: doc.id }, { upsert: true });
  }
  console.log(`${name}: ${snap.size} documents imported`);
}

// 2. Image files: from Firestore fileBlobs first, then any still missing from server/uploads.
const blobs = await firestore.collection('fileBlobs').get();
let fromFirestore = 0;
for (const meta of blobs.docs) {
  const { path, contentType, chunkCount } = meta.data();
  const chunks = await meta.ref.collection('chunks').get();
  const parts = chunks.docs.sort((a, b) => Number(a.id) - Number(b.id)).map((d) => Buffer.from(d.get('data')));
  if (!path || parts.length !== chunkCount) continue;
  await putFile(path, Buffer.concat(parts), contentType || 'image/webp');
  fromFirestore++;
}
console.log(`files from Firestore: ${fromFirestore}`);

async function listFiles(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...await listFiles(p));
    else if (e.isFile()) out.push(p);
  }
  return out;
}
const uploadsDir = resolve(values.uploads);
let fromDisk = 0;
for (const full of await listFiles(uploadsDir)) {
  const path = relative(uploadsDir, full).split(sep).join('/');
  if (await getFile(path)) continue;
  await putFile(path, await readFile(full), path.endsWith('.webp') ? 'image/webp' : 'application/octet-stream');
  fromDisk++;
}
console.log(`files from ${uploadsDir}: ${fromDisk}`);

// 3. Check: every image record has both of its files.
const images = await Image.find({}, 'fullPath thumbPath').lean();
const missing = [];
for (const img of images) {
  for (const p of [img.fullPath, img.thumbPath]) if (!(await getFile(p))) missing.push(p);
}
console.log(missing.length ? `MISSING ${missing.length} files: ${missing.slice(0, 5).join(', ')}` : `All ${images.length} images have their files in GridFS.`);

await disconnectDb();
process.exit(missing.length ? 1 : 0);

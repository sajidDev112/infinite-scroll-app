/**
 * Copies images saved with STORAGE_DRIVER=local (server/uploads) to Firebase Storage and
 * rewrites every /uploads/... link in Firestore (images, stories, published stories)
 * to the Firebase download URL. Safe to run more than once.
 *
 *   FIREBASE_STORAGE_BUCKET=<project>.firebasestorage.app npm run migrate-uploads -- --dry-run
 *   FIREBASE_STORAGE_BUCKET=<project>.firebasestorage.app npm run migrate-uploads
 */
import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { assertEnv, env } from '../src/config/env.js';
import { COLLECTIONS, getBucket, getDb, initFirebase } from '../src/config/firebase.js';
import { downloadUrl, UPLOADS_DIR } from '../src/services/fileStorage.js';

const { values } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false } } });
const dry = values['dry-run'];

if (!env.firebase.storageBucket) {
  console.error('Set FIREBASE_STORAGE_BUCKET (e.g. my-project.firebasestorage.app) before running this.');
  process.exit(1);
}
assertEnv();
initFirebase();
const bucket = getBucket();
const [bucketOk] = await bucket.exists();
if (!bucketOk) {
  console.error(`Bucket "${bucket.name}" was not found. Turn on Storage in the Firebase console first.`);
  process.exit(1);
}

async function listFiles(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...await listFiles(p));
    else if (e.isFile()) out.push(p);
  }
  return out;
}

// 1. Upload every local file (reusing the download token if it is already there).
const urlByPath = new Map();
const files = await listFiles(UPLOADS_DIR);
console.log(`${files.length} local files in ${UPLOADS_DIR}`);
let uploaded = 0;
for (const full of files) {
  const path = relative(UPLOADS_DIR, full).split(sep).join('/');
  const file = bucket.file(path);
  const [exists] = await file.exists();
  let token = exists ? (await file.getMetadata())[0]?.metadata?.firebaseStorageDownloadTokens?.split(',')[0] : null;
  if (!token) {
    token = randomUUID();
    if (!dry) {
      await file.save(await readFile(full), {
        resumable: false,
        contentType: path.endsWith('.webp') ? 'image/webp' : undefined,
        metadata: { cacheControl: 'public, max-age=31536000, immutable', metadata: { firebaseStorageDownloadTokens: token } },
      });
    }
    uploaded++;
  }
  urlByPath.set(path, downloadUrl(bucket.name, path, token));
}
console.log(`${dry ? 'Would upload' : 'Uploaded'} ${uploaded} files (${files.length - uploaded} were already there).`);

// 2. Rewrite links in Firestore. Matches relative and absolute (http://host/uploads/...) links.
const LINK = /^(?:https?:\/\/[^/]+)?\/uploads\/(.+)$/;
const missing = new Set();
const isPlain = (v) => v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype;
function rewrite(value) {
  if (typeof value === 'string') {
    const m = value.match(LINK);
    if (!m) return value;
    const url = urlByPath.get(decodeURIComponent(m[1].split('?')[0]));
    if (!url) missing.add(value);
    return url || value;
  }
  if (Array.isArray(value)) return value.map(rewrite);
  if (isPlain(value)) return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, rewrite(v)]));
  return value; // Timestamps and other Firestore types stay untouched
}

const db = getDb();
for (const name of [COLLECTIONS.images, COLLECTIONS.stories, COLLECTIONS.published]) {
  const snap = await db.collection(name).get();
  let changed = 0;
  for (const doc of snap.docs) {
    const data = doc.data();
    const update = {};
    for (const [k, v] of Object.entries(data)) {
      const nv = rewrite(v);
      if (JSON.stringify(nv) !== JSON.stringify(v)) update[k] = nv;
    }
    if (Object.keys(update).length) {
      changed++;
      if (!dry) await doc.ref.update(update);
    }
  }
  console.log(`${name}: ${dry ? 'would update' : 'updated'} ${changed} of ${snap.size} documents`);
}
if (missing.size) console.warn(`${missing.size} links point to files that are not in ${UPLOADS_DIR}:`, [...missing].slice(0, 5));
console.log(dry ? 'Dry run only — nothing was changed.' : 'Done. Set STORAGE_DRIVER=firebase and FIREBASE_STORAGE_BUCKET on the server.');
process.exit(0);

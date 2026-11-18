import { getDb } from '../config/firebase.js';

/**
 * STORAGE_DRIVER=firestore: image files kept in Firestore itself, for hosts without a
 * persistent disk and projects without Firebase Storage (e.g. Render's free plan).
 *
 *   fileBlobs/{id}            { path, contentType, size, chunkCount, createdAt }
 *   fileBlobs/{id}/chunks/{n} { data: <bytes> }
 *
 * Firestore documents are limited to 1 MiB, so files are split into chunks. They are
 * served at the same /uploads/<path> links as local files, so stored URLs don't change.
 */
const COLLECTION = 'fileBlobs';
const CHUNK = 900 * 1024;
const CACHE_LIMIT = Number(process.env.FILE_CACHE_MB || 128) * 1024 * 1024;

const docId = (path) => encodeURIComponent(path).replace(/\./g, '%2E');
const blobs = () => getDb().collection(COLLECTION);

export async function putFirestoreFile(path, buffer, contentType = 'image/webp') {
  const ref = blobs().doc(docId(path));
  await deleteFirestoreFile(path);
  const batch = getDb().batch();
  const chunkCount = Math.max(1, Math.ceil(buffer.length / CHUNK));
  for (let i = 0; i < chunkCount; i++) {
    batch.set(ref.collection('chunks').doc(String(i)), { data: buffer.subarray(i * CHUNK, (i + 1) * CHUNK) });
  }
  // Written last, so a file is only visible once all its chunks exist.
  batch.set(ref, { path, contentType, size: buffer.length, chunkCount, createdAt: new Date() });
  await batch.commit();
  cache.delete(path);
}

export async function deleteFirestoreFile(path) {
  const ref = blobs().doc(docId(path));
  const chunks = await ref.collection('chunks').listDocuments();
  if (chunks.length) {
    const batch = getDb().batch();
    chunks.forEach((c) => batch.delete(c));
    batch.delete(ref);
    await batch.commit();
  } else {
    await ref.delete();
  }
  cache.delete(path);
}

// Small in-memory LRU cache: popular images are read from Firestore once, not per visitor.
const cache = new Map();
let cacheBytes = 0;
function remember(path, file) {
  if (file.data.length > CACHE_LIMIT / 4) return;
  cache.set(path, file);
  cacheBytes += file.data.length;
  for (const [k, v] of cache) {
    if (cacheBytes <= CACHE_LIMIT) break;
    cache.delete(k);
    cacheBytes -= v.data.length;
  }
}

export async function getFirestoreFile(path) {
  const hit = cache.get(path);
  if (hit) {
    cache.delete(path); // move to the end (most recently used)
    cache.set(path, hit);
    return hit;
  }
  const ref = blobs().doc(docId(path));
  const meta = await ref.get();
  if (!meta.exists) return null;
  const { contentType, chunkCount, createdAt } = meta.data();
  const snap = await ref.collection('chunks').get();
  const parts = snap.docs.sort((a, b) => Number(a.id) - Number(b.id)).map((d) => Buffer.from(d.get('data')));
  if (parts.length !== chunkCount) return null; // still being written
  const file = { data: Buffer.concat(parts), contentType, etag: `"${meta.id}-${meta.updateTime?.toMillis?.() || ''}"`, createdAt };
  remember(path, file);
  return file;
}

/** Express handler for GET /uploads/*path. */
export async function serveFirestoreFile(req, res, next) {
  try {
    const path = [].concat(req.params.path || []).join('/');
    if (!path || path.includes('..')) return res.status(404).end();
    const file = await getFirestoreFile(path);
    if (!file) return res.status(404).json({ error: { message: 'File not found.' } });
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('ETag', file.etag);
    if (req.headers['if-none-match'] === file.etag) return res.status(304).end();
    res.type(file.contentType || 'application/octet-stream').send(file.data);
  } catch (err) {
    next(err);
  }
}

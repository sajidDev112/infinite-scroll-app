import mongoose from 'mongoose';

/**
 * Files kept in MongoDB GridFS, keyed by their path. Font files ("fonts/…") use the "fonts" bucket
 * (fonts.files / fonts.chunks); anything else (images, only when S3 is off) uses the "images" bucket.
 * This server serves them at /uploads/<path>, so stored links are relative and work on any host.
 */
export const LOCAL_PREFIX = '/uploads/';
const bucketName = (path) => (String(path).startsWith('fonts/') ? 'fonts' : 'images');
const CACHE_LIMIT = Number(process.env.FILE_CACHE_MB || 48) * 1024 * 1024; // fits a 512 MB host
const MAX_PARALLEL_READS = Number(process.env.FILE_READS_PARALLEL || 4);

const buckets = new Map();
function gridfs(path) {
  const db = mongoose.connection.db;
  if (!db) throw new Error('MongoDB is not connected.');
  const name = bucketName(path);
  let b = buckets.get(name);
  if (!b || b.s?.db !== db) buckets.set(name, (b = new mongoose.mongo.GridFSBucket(db, { bucketName: name })));
  return b;
}

const filesCol = (path) => mongoose.connection.db.collection(`${bucketName(path)}.files`);

/** Stores a file (replacing an older one with the same path) and returns its URL. */
export async function putFile(path, buffer, contentType = 'image/webp') {
  await deleteFile(path);
  await new Promise((resolve, reject) => {
    const up = gridfs(path).openUploadStream(path, { metadata: { contentType } });
    up.once('finish', resolve).once('error', reject);
    up.end(buffer);
  });
  return LOCAL_PREFIX + path;
}

export async function deleteFile(path) {
  if (!path) return;
  const files = await filesCol(path).find({ filename: path }, { projection: { _id: 1 } }).toArray();
  await Promise.all(files.map((f) => gridfs(path).delete(f._id).catch(() => {})));
  cache.delete(path);
}

// ---- reading: small LRU cache + a cap on parallel reads --------------------------------
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

const inFlight = new Map();
let active = 0;
const waiting = [];
async function limited(fn) {
  if (active >= MAX_PARALLEL_READS) await new Promise((r) => waiting.push(r));
  active++;
  try { return await fn(); } finally {
    active--;
    waiting.shift()?.();
  }
}

async function readFile(path) {
  const info = await filesCol(path).find({ filename: path }).sort({ uploadDate: -1 }).limit(1).next();
  if (!info) return null;
  const parts = [];
  await new Promise((resolve, reject) => {
    gridfs(path).openDownloadStream(info._id)
      .on('data', (c) => parts.push(c)).once('end', resolve).once('error', reject);
  });
  const file = {
    data: Buffer.concat(parts),
    contentType: info.metadata?.contentType || 'application/octet-stream',
    etag: `"${info._id}"`,
  };
  remember(path, file);
  return file;
}

export async function getFile(path) {
  const hit = cache.get(path);
  if (hit) {
    cache.delete(path); // most recently used goes to the end
    cache.set(path, hit);
    return hit;
  }
  if (!inFlight.has(path)) inFlight.set(path, limited(() => readFile(path)).finally(() => inFlight.delete(path)));
  return inFlight.get(path);
}

/** Express handler for GET /uploads/*path. */
export async function serveFile(req, res, next) {
  try {
    const path = [].concat(req.params.path || []).join('/');
    if (!path || path.split('/').some((p) => p === '..' || p === '.')) return res.status(404).end();
    const file = await getFile(path);
    if (!file) return res.status(404).json({ error: { message: 'File not found.' } });
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('ETag', file.etag);
    if (req.headers['if-none-match'] === file.etag) return res.status(304).end();
    res.type(file.contentType).send(file.data);
  } catch (err) {
    next(err);
  }
}

/** Turns stored relative /uploads/ URLs into absolute ones for clients on another origin. */
export function absolutizeUrls(value, origin) {
  if (typeof value === 'string') return value.startsWith(LOCAL_PREFIX) ? origin + value : value;
  if (Array.isArray(value)) return value.map((v) => absolutizeUrls(v, origin));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, absolutizeUrls(v, origin)]));
  }
  return value;
}

import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { env } from '../config/env.js';
import { getBucket } from '../config/firebase.js';
import { deleteFirestoreFile, putFirestoreFile } from './firestoreFiles.js';

/**
 * Where image files live. STORAGE_DRIVER=local (default) keeps them in server/uploads
 * and serves them at /uploads/...; STORAGE_DRIVER=firebase uses Firebase Storage.
 */
export const UPLOADS_DIR = resolve(env.uploadsDir);
export const LOCAL_PREFIX = '/uploads/';

function localPath(path) {
  const full = resolve(UPLOADS_DIR, path);
  if (!full.startsWith(UPLOADS_DIR + sep)) throw new Error('Invalid storage path.');
  return full;
}

/** Firebase download URL (works for both the real service and the Storage emulator). */
export function downloadUrl(bucketName, path, token) {
  const emu = process.env.FIREBASE_STORAGE_EMULATOR_HOST;
  const base = emu ? `http://${emu.replace(/^https?:\/\//, '')}` : 'https://firebasestorage.googleapis.com';
  return `${base}/v0/b/${bucketName}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
}

/** Stores a WebP file and returns the URL clients load it from. */
export async function putFile(path, buffer) {
  if (env.storageDriver === 'firestore') {
    await putFirestoreFile(path, buffer, 'image/webp');
    return LOCAL_PREFIX + path; // same /uploads/ links as local files
  }
  if (env.storageDriver === 'local') {
    const full = localPath(path);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, buffer);
    // Relative URL: browsers resolve it against the dashboard; desktop responses are made absolute.
    return LOCAL_PREFIX + path.split(sep).join('/');
  }
  const bucket = getBucket();
  const token = randomUUID();
  await bucket.file(path).save(buffer, {
    resumable: false,
    contentType: 'image/webp',
    metadata: {
      cacheControl: 'public, max-age=31536000, immutable',
      metadata: { firebaseStorageDownloadTokens: token },
    },
  });
  return downloadUrl(bucket.name, path, token);
}

export async function deleteFile(path) {
  if (!path) return;
  if (env.storageDriver === 'firestore') return deleteFirestoreFile(path);
  if (env.storageDriver === 'local') {
    await rm(localPath(path), { force: true });
    // Remove the now-empty per-image folder.
    await rm(dirname(localPath(path)), { recursive: false, force: true }).catch(() => {});
    return;
  }
  await getBucket().file(path).delete({ ignoreNotFound: true });
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

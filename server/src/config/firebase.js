import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { env, normalizePrivateKey } from './env.js';

let db = null;
let bucket = null;

function credential() {
  const f = env.firebase;
  if (f.serviceAccountPath) {
    const json = JSON.parse(readFileSync(resolve(process.cwd(), f.serviceAccountPath), 'utf8'));
    return cert({ ...json, private_key: normalizePrivateKey(json.private_key) });
  }
  if (f.projectId && f.clientEmail && f.privateKey) {
    return cert({ projectId: f.projectId, clientEmail: f.clientEmail, privateKey: f.privateKey });
  }
  return undefined; // emulator mode
}

export function initFirebase() {
  if (db) return { db, bucket };
  const app = getApps()[0] || initializeApp({
    credential: credential(),
    projectId: env.firebase.projectId || undefined,
    storageBucket: env.firebase.storageBucket || undefined,
  });
  db = getFirestore(app);
  db.settings({ ignoreUndefinedProperties: true });
  // Only needed with STORAGE_DRIVER=firebase; a bucket name may not be configured otherwise.
  if (env.firebase.storageBucket) bucket = getStorage(app).bucket();
  return { db, bucket };
}

export function getDb() {
  if (!db) initFirebase();
  return db;
}

export function getBucket() {
  if (!bucket) initFirebase();
  if (!bucket) throw new Error('Firebase Storage is not configured (FIREBASE_STORAGE_BUCKET is empty).');
  return bucket;
}

/** Test hook: inject fakes for Firestore / Storage. */
export function __setFirebase(fakes) {
  db = fakes.db;
  bucket = fakes.bucket;
}

export const COLLECTIONS = {
  admins: 'admins',
  stories: 'stories',
  published: 'publishedStories',
  images: 'images',
};

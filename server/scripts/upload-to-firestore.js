/**
 * Copies every image in server/uploads into Firestore (STORAGE_DRIVER=firestore storage).
 * Image links stay /uploads/..., so stories need no changes. Safe to run more than once.
 *   npm run upload-to-firestore
 */
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { assertEnv } from '../src/config/env.js';
import { initFirebase } from '../src/config/firebase.js';
import { UPLOADS_DIR } from '../src/services/fileStorage.js';
import { getFirestoreFile, putFirestoreFile } from '../src/services/firestoreFiles.js';

assertEnv();
initFirebase();

async function listFiles(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...await listFiles(p));
    else if (e.isFile()) out.push(p);
  }
  return out;
}

const files = await listFiles(UPLOADS_DIR);
console.log(`${files.length} files in ${UPLOADS_DIR}`);
let copied = 0;
let skipped = 0;
for (const full of files) {
  const path = relative(UPLOADS_DIR, full).split(sep).join('/');
  const data = await readFile(full);
  const existing = await getFirestoreFile(path);
  if (existing && existing.data.equals(data)) { skipped++; continue; }
  await putFirestoreFile(path, data, path.endsWith('.webp') ? 'image/webp' : 'application/octet-stream');
  copied++;
  process.stdout.write(`\r  copied ${copied}`);
}
console.log(`\nDone: ${copied} copied, ${skipped} already in Firestore.`);
process.exit(0);

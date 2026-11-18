import sharp from 'sharp';
import { COLLECTIONS, getDb } from '../config/firebase.js';
import { deleteFile, putFile } from './fileStorage.js';
import { ApiError } from '../utils/errors.js';
import { now, plain } from '../utils/serialize.js';

const FULL_MAX = 3840; // enough detail for 3× zoom on a 1080p screen
const THUMB_MAX = 640;
const ALLOWED_FORMATS = new Set(['jpeg', 'png', 'webp']);

const imagesCol = () => getDb().collection(COLLECTIONS.images);

/**
 * Validates an uploaded image by decoding it, normalises orientation, resizes,
 * re-encodes to WebP, stores full + thumbnail (server disk or Firebase Storage) and records it.
 */
export async function processAndStoreImage(file, adminId) {
  let meta;
  try {
    meta = await sharp(file.buffer).metadata();
  } catch {
    throw ApiError.badRequest(`${file.originalname}: file is not a valid image.`);
  }
  if (!ALLOWED_FORMATS.has(meta.format)) {
    throw ApiError.badRequest(`${file.originalname}: only JPG, PNG and WebP images are allowed.`);
  }

  const pipeline = sharp(file.buffer, { failOn: 'error' }).rotate();
  const [full, thumb] = await Promise.all([
    pipeline.clone().resize(FULL_MAX, FULL_MAX, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 84, effort: 4 }).toBuffer({ resolveWithObject: true }),
    pipeline.clone().resize(THUMB_MAX, THUMB_MAX, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 72 }).toBuffer({ resolveWithObject: true }),
  ]);

  const ref = imagesCol().doc();
  const fullPath = `story-images/${ref.id}/full.webp`;
  const thumbPath = `story-images/${ref.id}/thumb.webp`;
  const [url, thumbUrl] = await Promise.all([putFile(fullPath, full.data), putFile(thumbPath, thumb.data)]);

  const record = {
    url,
    thumbUrl,
    fullPath,
    thumbPath,
    width: full.info.width,
    height: full.info.height,
    size: full.info.size,
    originalName: file.originalname.slice(0, 200),
    originalSize: file.size,
    mimeType: 'image/webp',
    uploadedBy: adminId,
    createdAt: now(),
  };
  await ref.set(record);
  return { id: ref.id, ...plain(record) };
}

/** True if any story (working copy or published snapshot) still uses the image. */
export async function isImageReferenced(imageId) {
  const db = getDb();
  const [a, b] = await Promise.all([
    db.collection(COLLECTIONS.stories).where('imageIds', 'array-contains', imageId).limit(1).get(),
    db.collection(COLLECTIONS.published).where('imageIds', 'array-contains', imageId).limit(1).get(),
  ]);
  return !a.empty || !b.empty;
}

async function removeImage(imageId) {
  const doc = await imagesCol().doc(imageId).get();
  if (!doc.exists) return false;
  const { fullPath, thumbPath } = doc.data();
  await Promise.all([fullPath, thumbPath].map((p) => deleteFile(p)));
  await doc.ref.delete();
  return true;
}

/** DELETE /api/uploads/:id — refuses if a story still uses the image. */
export async function deleteImage(imageId) {
  const doc = await imagesCol().doc(imageId).get();
  if (!doc.exists) throw ApiError.notFound('Image not found.');
  if (await isImageReferenced(imageId)) {
    throw ApiError.conflict('This image is still used by a story. Remove it from the story and save first.');
  }
  await removeImage(imageId);
}

/** Deletes images that no story references any more (after saves / deletes). */
export async function cleanupImages(imageIds = []) {
  const unique = [...new Set(imageIds.filter(Boolean))];
  await Promise.all(
    unique.map(async (imageId) => {
      try {
        if (!(await isImageReferenced(imageId))) await removeImage(imageId);
      } catch (err) {
        console.warn(`[images] cleanup failed for ${imageId}:`, err.message);
      }
    }),
  );
}

export async function countImages() {
  const snap = await imagesCol().count().get();
  return snap.data().count;
}

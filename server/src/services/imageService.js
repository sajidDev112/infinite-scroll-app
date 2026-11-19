import sharp from 'sharp';
import { Image, PublishedStory, Story } from '../models/index.js';
import { deleteFile, putFile } from './fileStorage.js';
import { ApiError } from '../utils/errors.js';
import { newId, now, plain } from '../utils/serialize.js';

const FULL_MAX = 3840; // enough detail for 3× zoom on a 1080p screen
const THUMB_MAX = 640;
const ALLOWED_FORMATS = new Set(['jpeg', 'png', 'webp']);

/**
 * Validates an uploaded image by decoding it, normalises orientation, resizes,
 * re-encodes to WebP, stores full + thumbnail in GridFS and records it.
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

  const id = newId();
  const fullPath = `story-images/${id}/full.webp`;
  const thumbPath = `story-images/${id}/thumb.webp`;
  const [url, thumbUrl] = await Promise.all([putFile(fullPath, full.data), putFile(thumbPath, thumb.data)]);

  const doc = await Image.create({
    _id: id,
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
  });
  return plain(doc.toObject());
}

/** True if any story (working copy or published snapshot) still uses the image. */
export async function isImageReferenced(imageId) {
  const [a, b] = await Promise.all([
    Story.exists({ imageIds: imageId }),
    PublishedStory.exists({ imageIds: imageId }),
  ]);
  return Boolean(a || b);
}

async function removeImage(imageId) {
  const image = await Image.findById(imageId).lean();
  if (!image) return false;
  await Promise.all([image.fullPath, image.thumbPath].map((p) => deleteFile(p)));
  await Image.deleteOne({ _id: imageId });
  return true;
}

/** DELETE /api/uploads/:id — refuses if a story still uses the image. */
export async function deleteImage(imageId) {
  if (!(await Image.exists({ _id: imageId }))) throw ApiError.notFound('Image not found.');
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
  return Image.countDocuments();
}

import sharp from 'sharp';
import { Image, PublishedStory, Setting, Story } from '../models/index.js';
import { currentStore, rootFolder, storeOf } from './imageStore.js';
import { ApiError } from '../utils/errors.js';
import { newId, now, plain } from '../utils/serialize.js';
import { relinkImages } from '../../../shared/engine/defaults.js';

const FULL_MAX = 3840; // enough detail for 3× zoom on a 1080p screen
const THUMB_MAX = 640;
const ALLOWED_FORMATS = new Set(['jpeg', 'png', 'webp']);
export const SETTINGS_OWNER = 'settings';
const PENDING_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** "The Lighthouse at Dawn!" → "the-lighthouse-at-dawn" */
export function slugify(text, max = 50) {
  return String(text || '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, max).replace(/-+$/, '');
}

/** A story's folder name: its title plus a short piece of its id (two stories may share a title). */
export const storyFolderName = (story) => `${slugify(story.title) || 'story'}-${String(story._id || story.id).slice(0, 6).toLowerCase()}`;

function folderPath(owner, story) {
  if (owner === SETTINGS_OWNER) return `${rootFolder()}/settings/footer-logo`;
  if (story) return `${rootFolder()}/stories/${story.folder || storyFolderName(story)}`;
  return `${rootFolder()}/pending-uploads`; // filed into a story folder when the story is saved
}

function fileKeys(folder, imageId, originalName) {
  const base = slugify(String(originalName || '').replace(/\.[^.]+$/, ''), 40) || 'image';
  return { full: `${folder}/${base}-${imageId}-full.webp`, thumb: `${folder}/${base}-${imageId}-thumb.webp` };
}

/** The story's folder name, saved on first use (kept when the story is renamed later). */
export async function ensureStoryFolder(story) {
  if (story.folder) return story.folder;
  const folder = storyFolderName(story);
  await Story.updateOne({ _id: story._id, folder: null }, { $set: { folder } });
  const fresh = await Story.findById(story._id, 'folder').lean();
  story.folder = fresh?.folder || folder;
  return story.folder;
}

/**
 * Validates an uploaded image by decoding it, normalises orientation, resizes,
 * re-encodes to WebP and stores full + thumbnail: in the story's folder when `storyId`
 * is given, in settings/ for the footer logo, otherwise in pending-uploads/.
 */
export async function processAndStoreImage(file, adminId, { storyId = null, scope = null } = {}) {
  let meta;
  try {
    meta = await sharp(file.buffer).metadata();
  } catch {
    throw ApiError.badRequest(`${file.originalname}: file is not a valid image.`);
  }
  if (!ALLOWED_FORMATS.has(meta.format)) {
    throw ApiError.badRequest(`${file.originalname}: only JPG, PNG and WebP images are allowed.`);
  }

  let owner = scope === 'footer' ? SETTINGS_OWNER : null;
  let story = null;
  if (!owner && storyId) {
    story = await Story.findById(String(storyId), 'title folder').lean();
    if (story) {
      await ensureStoryFolder(story);
      owner = story._id;
    }
  }

  const pipeline = sharp(file.buffer, { failOn: 'error' }).rotate();
  const [full, thumb] = await Promise.all([
    pipeline.clone().resize(FULL_MAX, FULL_MAX, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 84, effort: 4 }).toBuffer({ resolveWithObject: true }),
    pipeline.clone().resize(THUMB_MAX, THUMB_MAX, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 72 }).toBuffer({ resolveWithObject: true }),
  ]);

  const id = newId();
  const store = currentStore();
  const keys = fileKeys(folderPath(owner, story), id, file.originalname);
  const [url, thumbUrl] = await Promise.all([
    store.put(keys.full, full.data, 'image/webp'),
    store.put(keys.thumb, thumb.data, 'image/webp'),
  ]);

  const doc = await Image.create({
    _id: id,
    url,
    thumbUrl,
    fullPath: keys.full,
    thumbPath: keys.thumb,
    width: full.info.width,
    height: full.info.height,
    size: full.info.size,
    originalName: file.originalname.slice(0, 200),
    originalSize: file.size,
    mimeType: 'image/webp',
    storage: store.name,
    owner,
    uploadedBy: adminId,
    createdAt: now(),
  });
  return plain(doc.toObject());
}

/** True if any story (working copy or published snapshot) or the footer logo still uses the image. */
export async function isImageReferenced(imageId, { exceptStory = null } = {}) {
  const notThis = exceptStory ? { _id: { $ne: exceptStory } } : {};
  const [a, b, footer] = await Promise.all([
    Story.exists({ ...notThis, imageIds: imageId }),
    PublishedStory.exists({ ...notThis, imageIds: imageId }),
    Setting.exists({ _id: 'footer', 'value.logo.imageId': imageId }),
  ]);
  return Boolean(a || b || footer);
}

async function removeFiles(image) {
  const store = storeOf(image);
  await Promise.all([image.fullPath, image.thumbPath].map((p) => store.remove(p).catch(() => {})));
}

async function removeImage(imageId) {
  const image = await Image.findById(imageId).lean();
  if (!image) return false;
  await removeFiles(image);
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

/** Copies an image's files to `keys` in the current store (works across GridFS → S3). */
async function copyFiles(image, keys) {
  const from = storeOf(image);
  const to = currentStore();
  if (from.name === to.name) {
    return Promise.all([from.copy(image.fullPath, keys.full), from.copy(image.thumbPath, keys.thumb)]);
  }
  return Promise.all([[image.fullPath, keys.full], [image.thumbPath, keys.thumb]].map(async ([src, dest]) => {
    const file = await from.read(src);
    if (!file) throw new Error(`file missing: ${src}`);
    return to.put(dest, file.data, file.contentType || 'image/webp');
  }));
}

/**
 * Files the images a story uses into the story's own folder:
 *  - an image not filed yet (new upload, or an old one from before S3) and used by no
 *    other story is MOVED there (same image id);
 *  - an image that belongs to another story (e.g. after Duplicate) is COPIED, so each
 *    story keeps its own files; the copy gets a new id.
 * Both the working copy and the published snapshot are updated.
 * Returns { changes: { oldId: { imageId, url, thumbUrl } }, missing: [ids] }.
 */
export async function fileStoryImages(storyId, { dryRun = false, log = null, keepOld = false } = {}) {
  const story = await Story.findById(String(storyId)).lean();
  if (!story) return { changes: {}, missing: [] };
  const pub = await PublishedStory.findById(story._id).lean();
  const ids = [...new Set([...(story.imageIds || []), ...(pub?.imageIds || [])])];
  if (!ids.length) return { changes: {}, missing: [] };

  const folder = dryRun ? story.folder || storyFolderName(story) : await ensureStoryFolder(story);
  const target = currentStore();
  const changes = {};
  const canonical = {}; // already filed: just make sure the links point at the right files
  const moved = [];
  const missing = [];

  const byId = new Map((await Image.find({ _id: { $in: ids } }).lean()).map((i) => [i._id, i]));
  for (const id of ids) {
    const image = byId.get(id);
    if (!image) {
      missing.push(id);
      continue;
    }
    if (image.owner === story._id && (image.storage || 'gridfs') === target.name) {
      canonical[id] = { imageId: id, url: image.url, thumbUrl: image.thumbUrl };
      continue;
    }

    const shared = image.owner ? image.owner !== story._id : await isImageReferenced(id, { exceptStory: story._id });
    const newId_ = shared ? newId() : id;
    const keys = fileKeys(`${rootFolder()}/stories/${folder}`, newId_, image.originalName);
    log?.(`${shared ? 'copy' : 'move'} ${id} → ${keys.full}`);
    if (dryRun) {
      changes[id] = { imageId: newId_, url: '(dry run)', thumbUrl: '(dry run)' };
      continue;
    }
    try {
      const [url, thumbUrl] = await copyFiles(image, keys);
      if (shared) {
        const { _id, ...rest } = image;
        await Image.create({ ...rest, _id: newId_, url, thumbUrl, fullPath: keys.full, thumbPath: keys.thumb, storage: target.name, owner: story._id, createdAt: now() });
      } else {
        await Image.updateOne({ _id: id }, { $set: { url, thumbUrl, fullPath: keys.full, thumbPath: keys.thumb, storage: target.name, owner: story._id } });
        moved.push(image);
      }
      changes[id] = { imageId: newId_, url, thumbUrl };
    } catch (err) {
      if (!/file missing/.test(err.message)) throw err;
      missing.push(id);
      log?.(`  ! ${err.message} — skipped`);
    }
  }

  const all = { ...canonical, ...changes };
  const pick = (d) => JSON.stringify([d.coverImage, d.thumbnail, d.intro, d.scenes]);
  const stale = (doc) => doc && pick(relinkImages(doc, all)) !== pick(doc);
  if (!dryRun && (Object.keys(changes).length || stale(story) || stale(pub))) {
    const fix = (doc) => {
      const next = relinkImages(doc, all);
      const ids2 = new Set();
      if (next.coverImage?.imageId) ids2.add(next.coverImage.imageId);
      if (next.intro?.imageId) ids2.add(next.intro.imageId);
      (next.scenes || []).forEach((s) => s.imageId && ids2.add(s.imageId));
      return { coverImage: next.coverImage ?? null, thumbnail: next.thumbnail ?? null, intro: next.intro ?? null, scenes: next.scenes || [], imageIds: [...ids2] };
    };
    const { thumbnail, ...storyFix } = fix(story);
    await Story.updateOne({ _id: story._id }, { $set: { ...storyFix, ...(story.thumbnail ? { thumbnail } : {}) } });
    if (pub) {
      const { thumbnail: _t, ...pubFix } = fix(pub);
      await PublishedStory.updateOne({ _id: pub._id }, { $set: pubFix });
    }
    // Moved images: the old files are no longer used anywhere.
    if (!keepOld) await Promise.all(moved.map((img) => removeFiles(img)));
  }
  return { changes: dryRun ? changes : all, missing };
}

/** The footer logo goes in settings/footer-logo (moved there if it was uploaded elsewhere). */
export async function fileFooterLogo(logo, { dryRun = false, log = null, keepOld = false } = {}) {
  if (!logo?.imageId) return logo;
  const image = await Image.findById(logo.imageId).lean();
  if (!image) return logo;
  const target = currentStore();
  if (image.owner === SETTINGS_OWNER && (image.storage || 'gridfs') === target.name) return { ...logo, url: image.url };
  const keys = fileKeys(folderPath(SETTINGS_OWNER), image._id, image.originalName);
  log?.(`move footer logo ${image._id} → ${keys.full}`);
  if (dryRun) return logo;
  const [url, thumbUrl] = await copyFiles(image, keys);
  await Image.updateOne({ _id: image._id }, { $set: { url, thumbUrl, fullPath: keys.full, thumbPath: keys.thumb, storage: target.name, owner: SETTINGS_OWNER } });
  if (!keepOld) await removeFiles(image);
  return { ...logo, url };
}

/** Uploads never saved into a story (e.g. the editor was closed) are removed after a day. */
export async function cleanupPendingUploads() {
  const old = await Image.find({ owner: null, createdAt: { $lt: new Date(Date.now() - PENDING_MAX_AGE_MS) }, fullPath: /\/pending-uploads\// }, '_id').lean();
  await cleanupImages(old.map((i) => i._id));
  return old.length;
}

export async function countImages() {
  return Image.countDocuments();
}

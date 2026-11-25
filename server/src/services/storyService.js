import { PublishedStory, Story } from '../models/index.js';
import { ApiError } from '../utils/errors.js';
import { newId, now, plain } from '../utils/serialize.js';
import { collectImageIds, createIntro } from '../../../shared/engine/defaults.js';
import { validateForPublish } from '../../../shared/engine/validate.js';
import { cleanupImages, fileStoryImages, storyFolderName } from './imageService.js';

const SUMMARY_FIELDS = [
  'title', 'description', 'category', 'coverImage', 'thumbnail', 'status', 'sceneCount',
  'imageCount', 'isPublished', 'publishedAt', 'hasUnpublishedChanges', 'createdAt', 'updatedAt',
].join(' ');

/** Fields derived from content, recomputed on every write. */
function derived(story) {
  const scenes = [...(story.scenes || [])]
    .sort((a, b) => a.order - b.order)
    .map((s, i) => ({ ...s, order: i }));
  const first = scenes[0];
  const thumbnail = story.coverImage
    || (first ? { imageId: first.imageId, url: first.imageUrl, thumbUrl: first.thumbUrl, width: first.imageWidth, height: first.imageHeight } : null);
  const imageIds = collectImageIds({ ...story, scenes });
  return {
    scenes,
    thumbnail,
    imageIds,
    imageCount: imageIds.length,
    sceneCount: scenes.length,
    titleLower: String(story.title || '').toLowerCase(),
  };
}

async function findStory(id) {
  const story = await Story.findById(String(id)).lean();
  if (!story) throw ApiError.notFound('Story not found.');
  return story;
}

export async function getStory(id) {
  return plain(await findStory(id));
}

export async function listStories({ page, limit, search, status, sort }) {
  const all = (await Story.find({}, SUMMARY_FIELDS).lean()).map(plain);

  const counts = { all: all.length, active: 0, inactive: 0, draft: 0 };
  all.forEach((s) => { counts[s.status] = (counts[s.status] || 0) + 1; });

  const q = search.toLowerCase();
  let items = all.filter((s) => (status === 'all' || s.status === status)
    && (!q || s.title?.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q) || s.category?.toLowerCase().includes(q)));

  const by = {
    newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
    oldest: (a, b) => a.createdAt.localeCompare(b.createdAt),
    updated: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
    title: (a, b) => a.title.localeCompare(b.title),
  }[sort];
  items.sort(by);

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  items = items.slice((page - 1) * limit, page * limit);
  return { items, pagination: { page, limit, total, totalPages }, counts };
}

export async function createStory(input, admin) {
  if (input.status === 'active') {
    throw ApiError.conflict('A new story must be published before it can be active. Save it as a draft first.');
  }
  const ts = now();
  const base = {
    title: input.title,
    description: input.description || '',
    category: input.category || '',
    coverImage: input.coverImage || null,
    status: input.status || 'draft',
    intro: input.intro || createIntro(),
    scenes: input.scenes || [],
  };
  const id = newId();
  const doc = await Story.create({
    _id: id,
    folder: storyFolderName({ _id: id, title: base.title }),
    ...base,
    ...derived(base),
    isPublished: false,
    publishedAt: null,
    hasUnpublishedChanges: false,
    createdAt: ts,
    updatedAt: ts,
    createdBy: admin.id,
    updatedBy: admin.id,
  });
  return withFiledImages(doc._id);
}

/**
 * Moves / copies the story's images into its own folder, then returns the story plus
 * `imageChanges` ({ oldId: { imageId, url, thumbUrl } }) so the editor can update its links.
 */
async function withFiledImages(id) {
  let imageChanges = {};
  try {
    imageChanges = (await fileStoryImages(id)).changes;
  } catch (err) {
    // The story is saved either way; filing is retried on the next save.
    console.warn(`[images] could not file images for story ${id}:`, err.message);
  }
  return { ...(await getStory(id)), imageChanges };
}

export async function updateStory(id, patch, admin) {
  const current = await findStory(id);
  const next = { ...current, ...patch };

  if (patch.status && patch.status !== current.status) {
    assertStatusAllowed(patch.status, current);
  }

  const d = derived(next);
  const contentChanged = Object.keys(patch).some((k) => k !== 'status');
  const update = {
    ...patch,
    ...d,
    hasUnpublishedChanges: Boolean(current.isPublished && (contentChanged || current.hasUnpublishedChanges)),
    updatedAt: now(),
    updatedBy: admin.id,
  };
  const statusChanged = patch.status && patch.status !== current.status;
  if (statusChanged && patch.status === 'draft' && current.isPublished) {
    // Moving back to draft unpublishes the story.
    Object.assign(update, { isPublished: false, publishedAt: null, hasUnpublishedChanges: false });
    await PublishedStory.deleteOne({ _id: current._id });
  } else if (statusChanged && current.isPublished) {
    await PublishedStory.updateOne({ _id: current._id }, { $set: { status: patch.status } });
  }
  await Story.updateOne({ _id: current._id }, { $set: update });

  const removed = (current.imageIds || []).filter((x) => !d.imageIds.includes(x));
  if (removed.length) cleanupImages(removed);
  return withFiledImages(id);
}

function assertStatusAllowed(status, current) {
  if (status === 'active' && !current.isPublished) {
    throw ApiError.conflict('Publish the story first — only published stories can be active.');
  }
}

export async function setStatus(id, status, admin) {
  return updateStory(id, { status }, admin);
}

export async function publishStory(id, admin) {
  const story = await findStory(id);
  const errors = validateForPublish(story);
  if (errors.length) {
    throw ApiError.unprocessable('This story is not ready to publish.', errors);
  }
  const ts = now();
  const d = derived(story);
  const snapshot = {
    _id: story._id,
    storyId: story._id,
    title: story.title,
    description: story.description || '',
    category: story.category || '',
    coverImage: d.thumbnail,
    intro: story.intro || createIntro(),
    scenes: d.scenes,
    imageIds: d.imageIds,
    sceneCount: d.sceneCount,
    titleLower: d.titleLower,
    status: 'active',
    publishedAt: ts,
    updatedAt: ts,
    version: (story.publishedVersion || 0) + 1,
  };
  await PublishedStory.replaceOne({ _id: story._id }, snapshot, { upsert: true });
  await Story.updateOne({ _id: story._id }, {
    $set: {
      status: 'active',
      isPublished: true,
      publishedAt: ts,
      publishedVersion: snapshot.version,
      hasUnpublishedChanges: false,
      updatedAt: ts,
      updatedBy: admin.id,
    },
  });
  return getStory(id);
}

export async function deleteStory(id) {
  const story = await findStory(id);
  const pub = await PublishedStory.findById(story._id, 'imageIds').lean();
  const ids = [...(story.imageIds || []), ...(pub?.imageIds || [])];
  await Promise.all([Story.deleteOne({ _id: story._id }), PublishedStory.deleteOne({ _id: story._id })]);
  await cleanupImages(ids);
}

export async function duplicateStory(id, admin) {
  const source = await findStory(id);
  return createStory({
    title: `${source.title} (Copy)`.slice(0, 160),
    description: source.description,
    category: source.category,
    coverImage: source.coverImage,
    status: 'draft',
    intro: source.intro,
    scenes: source.scenes,
  }, admin);
}

export async function dashboardStats() {
  const [total, active, inactive, draft, live, recent] = await Promise.all([
    Story.countDocuments(),
    Story.countDocuments({ status: 'active' }),
    Story.countDocuments({ status: 'inactive' }),
    Story.countDocuments({ status: 'draft' }),
    PublishedStory.countDocuments({ status: 'active' }),
    Story.find({}, SUMMARY_FIELDS).sort({ updatedAt: -1 }).limit(6).lean(),
  ]);
  return {
    totals: { total, active, inactive, draft, live },
    recentStories: recent.map(plain),
  };
}

// ---- desktop / client (public, read-only) ------------------------------------------
export async function listPublishedStories({ search, category }) {
  const all = (await PublishedStory.find({ status: 'active' }, 'title description category coverImage sceneCount publishedAt').lean()).map(plain);
  const categories = [...new Set(all.map((s) => s.category).filter(Boolean))].sort();
  const q = search.toLowerCase();
  const items = all
    .filter((s) => (!category || s.category === category)
      && (!q || s.title.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q)))
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  return { items, categories };
}

export async function getPublishedStory(id) {
  const doc = await PublishedStory.findById(String(id)).lean();
  if (!doc || doc.status !== 'active') throw ApiError.notFound('Story not found or not published.');
  const { imageIds, titleLower, ...rest } = doc;
  return plain(rest);
}

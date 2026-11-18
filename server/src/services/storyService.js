import { COLLECTIONS, getDb } from '../config/firebase.js';
import { ApiError } from '../utils/errors.js';
import { now, plain } from '../utils/serialize.js';
import { collectImageIds, createIntro } from '../../../shared/engine/defaults.js';
import { validateForPublish } from '../../../shared/engine/validate.js';
import { cleanupImages } from './imageService.js';

const stories = () => getDb().collection(COLLECTIONS.stories);
const published = () => getDb().collection(COLLECTIONS.published);

const SUMMARY_FIELDS = [
  'title', 'description', 'category', 'coverImage', 'thumbnail', 'status', 'sceneCount',
  'imageCount', 'isPublished', 'publishedAt', 'hasUnpublishedChanges', 'createdAt', 'updatedAt',
];

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

async function getStoryDoc(id) {
  const doc = await stories().doc(id).get();
  if (!doc.exists) throw ApiError.notFound('Story not found.');
  return doc;
}

export async function getStory(id) {
  const doc = await getStoryDoc(id);
  return { id: doc.id, ...plain(doc.data()) };
}

export async function listStories({ page, limit, search, status, sort }) {
  const snap = await stories().select(...SUMMARY_FIELDS).get();
  const all = snap.docs.map((d) => ({ id: d.id, ...plain(d.data()) }));

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
  const data = {
    ...base,
    ...derived(base),
    isPublished: false,
    publishedAt: null,
    hasUnpublishedChanges: false,
    createdAt: ts,
    updatedAt: ts,
    createdBy: admin.id,
    updatedBy: admin.id,
  };
  const ref = await stories().add(data);
  return { id: ref.id, ...plain(data) };
}

export async function updateStory(id, patch, admin) {
  const doc = await getStoryDoc(id);
  const current = doc.data();
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
  const batch = getDb().batch();
  if (statusChanged && patch.status === 'draft' && current.isPublished) {
    // Moving back to draft unpublishes the story.
    Object.assign(update, { isPublished: false, publishedAt: null, hasUnpublishedChanges: false });
    batch.delete(published().doc(id));
  } else if (statusChanged && current.isPublished) {
    batch.update(published().doc(id), { status: patch.status });
  }
  batch.update(doc.ref, update);
  await batch.commit();

  const removed = (current.imageIds || []).filter((x) => !d.imageIds.includes(x));
  if (removed.length) cleanupImages(removed);
  return getStory(id);
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
  const doc = await getStoryDoc(id);
  const story = doc.data();
  const errors = validateForPublish(story);
  if (errors.length) {
    throw ApiError.unprocessable('This story is not ready to publish.', errors);
  }
  const ts = now();
  const d = derived(story);
  const snapshot = {
    storyId: id,
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
  const batch = getDb().batch();
  batch.set(published().doc(id), snapshot);
  batch.update(doc.ref, {
    status: 'active',
    isPublished: true,
    publishedAt: ts,
    publishedVersion: snapshot.version,
    hasUnpublishedChanges: false,
    updatedAt: ts,
    updatedBy: admin.id,
  });
  await batch.commit();
  return getStory(id);
}

export async function deleteStory(id) {
  const doc = await getStoryDoc(id);
  const pub = await published().doc(id).get();
  const ids = [...(doc.data().imageIds || []), ...(pub.exists ? pub.data().imageIds || [] : [])];
  const batch = getDb().batch();
  batch.delete(doc.ref);
  batch.delete(published().doc(id));
  await batch.commit();
  await cleanupImages(ids);
}

export async function duplicateStory(id, admin) {
  const source = (await getStoryDoc(id)).data();
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
  const col = stories();
  const count = async (q) => (await q.count().get()).data().count;
  const [total, active, inactive, draft, publishedCount, recent] = await Promise.all([
    count(col),
    count(col.where('status', '==', 'active')),
    count(col.where('status', '==', 'inactive')),
    count(col.where('status', '==', 'draft')),
    count(published().where('status', '==', 'active')),
    col.orderBy('updatedAt', 'desc').limit(6).select(...SUMMARY_FIELDS).get(),
  ]);
  return {
    totals: { total, active, inactive, draft, live: publishedCount },
    recentStories: recent.docs.map((d) => ({ id: d.id, ...plain(d.data()) })),
  };
}

// ---- desktop (public, read-only) ---------------------------------------------------
export async function listPublishedStories({ search, category }) {
  const snap = await published()
    .where('status', '==', 'active')
    .select('title', 'description', 'category', 'coverImage', 'sceneCount', 'publishedAt')
    .get();
  const all = snap.docs.map((d) => ({ id: d.id, ...plain(d.data()) }));
  const categories = [...new Set(all.map((s) => s.category).filter(Boolean))].sort();
  const q = search.toLowerCase();
  const items = all
    .filter((s) => (!category || s.category === category)
      && (!q || s.title.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q)))
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  return { items, categories };
}

export async function getPublishedStory(id) {
  const doc = await published().doc(id).get();
  if (!doc.exists || doc.data().status !== 'active') throw ApiError.notFound('Story not found or not published.');
  const { imageIds, titleLower, ...rest } = doc.data();
  return { id: doc.id, ...plain(rest) };
}

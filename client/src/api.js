// Uses the two public endpoints only: list active stories, and one story.
const API_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
export const SHARE_URL = import.meta.env.VITE_SHARE_URL || '';

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, { signal } = {}) {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 15000);
  signal?.addEventListener('abort', () => ctrl.abort());
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
  } catch (err) {
    if (signal?.aborted) throw err;
    throw new ApiError('We could not reach the stories right now. Check your connection and try again.', 0);
  } finally {
    clearTimeout(timeout);
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(body?.error?.message || `Request failed (${res.status}).`, res.status);
  return body;
}

// Small in-memory cache so going back to the list is instant.
let listCache = null;
const storyCache = new Map();

export const api = {
  cachedList: () => listCache,
  async listStories({ force = false, signal } = {}) {
    if (listCache && !force) return listCache;
    listCache = await request('/desktop/stories', { signal });
    return listCache;
  },
  async getStory(id, { signal } = {}) {
    if (storyCache.has(id)) return storyCache.get(id);
    const { story } = await request(`/desktop/stories/${encodeURIComponent(id)}`, { signal });
    storyCache.set(id, story);
    return story;
  },
  /** Warm the story JSON and first images while the visitor hovers a card. */
  prefetch(id) {
    if (storyCache.has(id)) return;
    api.getStory(id).then((s) => {
      [s.intro?.imageUrl || s.coverImage?.url, s.scenes?.[0]?.imageUrl].filter(Boolean).forEach((src) => {
        const img = new Image();
        img.src = src;
      });
    }).catch(() => {});
  },
  clearStoryCache: () => storyCache.clear(),
};

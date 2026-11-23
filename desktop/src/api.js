/* global __APP_VERSION__ */
const FALLBACK_API = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace(/\/$/, '');

let configPromise = null;

/** API base URL + version: runtime config (Electron) → build-time env → localhost. */
export function getConfig() {
  if (!configPromise) {
    configPromise = (window.storyframe?.getConfig?.() ?? Promise.resolve({}))
      .catch(() => ({}))
      .then((cfg) => ({
        apiUrl: (cfg.apiUrl || FALLBACK_API).replace(/\/$/, ''),
        version: cfg.version || __APP_VERSION__,
        shareUrl: cfg.shareUrl || import.meta.env.VITE_SHARE_URL || '',
      }));
  }
  return configPromise;
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, { signal } = {}) {
  const { apiUrl } = await getConfig();
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 15000);
  signal?.addEventListener('abort', () => ctrl.abort());
  let res;
  try {
    res = await fetch(`${apiUrl}${path}`, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
  } catch (err) {
    if (signal?.aborted) throw err;
    throw new ApiError('Cannot reach the story server. Check your connection and try again.', 0);
  } finally {
    clearTimeout(timeout);
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(body?.error?.message || `Request failed (${res.status}).`, res.status);
  return body;
}

// Small in-memory cache so going back to the list is instant; refresh bypasses it.
let listCache = null;
const storyCache = new Map();
let footerCache = null;

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
  /** Warm the story JSON + first images while the user hovers a card. */
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
  /** Fonts uploaded in admin Settings (for story text); [] if they cannot load. */
  async getFonts() {
    try {
      return (await request('/desktop/fonts')).fonts || [];
    } catch {
      return []; // text falls back to the built-in fonts
    }
  },
  /** Intro footer (share buttons, logo, name) from admin Settings; null if it cannot load. */
  async getFooter({ signal } = {}) {
    if (footerCache) return footerCache;
    try {
      footerCache = (await request('/desktop/settings', { signal })).footer;
    } catch {
      return null; // the player falls back to the built-in footer
    }
    return footerCache;
  },
};

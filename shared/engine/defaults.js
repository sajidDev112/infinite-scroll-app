import { DEFAULT_SCROLL_LENGTH } from './constants.js';

export function uid(prefix = 'id') {
  const rand = globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 12)
    : Math.random().toString(36).slice(2, 14);
  return `${prefix}_${rand}`;
}

export function createTextElement(overrides = {}) {
  return {
    id: uid('txt'),
    content: 'Your text here',
    fontFamily: 'Inter Variable',
    fontSize: 56,
    fontWeight: 600,
    fontStyle: 'normal',
    textDecoration: 'none',
    letterSpacing: 0,
    lineHeight: 1.2,
    textAlignment: 'left',
    textTransform: 'none',
    color: '#ffffff',
    backgroundType: 'none',
    backgroundColor: '#000000',
    backgroundOpacity: 0.5,
    backgroundGradient: { from: '#4f46e5', to: '#9333ea', angle: 135 },
    borderColor: '#ffffff',
    borderWidth: 0,
    borderRadius: 0,
    padding: 0,
    shadow: { enabled: true, color: 'rgba(0,0,0,0.55)', blur: 18, x: 0, y: 2 },
    positionX: 0.08,
    positionY: 0.62,
    width: 0.5,
    height: 0,
    rotation: 0,
    zIndex: 1,
    opacity: 1,
    animationType: 'slideUp',
    animationDuration: 0.1,
    animationDelay: 0,
    easing: 'power3.out',
    persist: false,
    ...overrides,
  };
}

/** Intro text uses seconds for timing, scene text uses scene-scroll fractions. */
export function createIntroText(overrides = {}) {
  return createTextElement({ animationDuration: 1.1, animationDelay: 0.2, ...overrides });
}

export function createStep(overrides = {}) {
  return {
    stepId: uid('step'),
    progress: 0,
    zoomLevel: 1,
    focalPoint: { x: 0.5, y: 0.5, targetPositionX: 0.5, targetPositionY: 0.5 },
    // Sine in-out: the gentlest start and stop, so slow zooms glide instead of lurching.
    transitionSettings: { easing: 'sine.inOut', duration: 1, blur: 0 },
    textElements: [],
    ...overrides,
  };
}

export function imageRef(img) {
  if (!img) return null;
  return {
    imageId: img.imageId || img.id,
    url: img.url,
    thumbUrl: img.thumbUrl || img.url,
    width: img.width,
    height: img.height,
  };
}

export function createScene(img, order = 0) {
  return {
    sceneId: uid('scene'),
    imageId: img.imageId || img.id,
    imageUrl: img.url,
    thumbUrl: img.thumbUrl || img.url,
    imageWidth: img.width,
    imageHeight: img.height,
    order,
    title: '',
    scrollLength: DEFAULT_SCROLL_LENGTH,
    fit: 'cover',
    overlayColor: '#000000',
    overlayOpacity: 0, // per-scene darkening behind the text (0 = off)
    transition: { type: 'slideOver', duration: 1 },
    animationSteps: [createStep({ progress: 0 }), createStep({ progress: 1 })],
  };
}

export function createIntro() {
  return {
    imageId: null,
    imageUrl: null,
    thumbUrl: null,
    imageWidth: null,
    imageHeight: null,
    overlayColor: '#000000',
    overlayOpacity: 0.35,
    exitType: 'slideOver', // or 'fade'
    textElements: [],
  };
}

/** Key of an intro background choice in intro.layouts ('auto' = cover or first scene). */
export const introLayoutKey = (imageId) => imageId || 'auto';

const INTRO_LOOK = ['textElements', 'overlayColor', 'overlayOpacity', 'showFooter'];

/**
 * Whether the intro shows the logo + social icons. Set per background with intro.showFooter;
 * by default only the cover image (or the Automatic choice) shows them.
 */
export function introShowsFooter(story) {
  const intro = story?.intro;
  if (typeof intro?.showFooter === 'boolean') return intro.showFooter;
  const id = intro?.imageId;
  // No cover image: the first scene stands in for it (as on the story card).
  const coverId = story?.coverImage?.imageId ?? story?.scenes?.[0]?.imageId;
  return !id || id === coverId;
}

/**
 * Switches the intro background. Each background choice keeps its own text and overlay:
 * the current one is stored in intro.layouts under its key, and the new background's saved
 * text/overlay (or a blank start) becomes the active intro.textElements/overlay, which is
 * what viewers see. `keepKeys` (optional) drops saved layouts of images no longer in the story.
 */
export function switchIntroImage(intro, img, keepKeys = null) {
  const from = introLayoutKey(intro?.imageId);
  const to = introLayoutKey(img?.imageId);
  if (from === to) return intro;
  const layouts = { ...(intro.layouts || {}) };
  layouts[from] = Object.fromEntries(INTRO_LOOK.map((k) => [k, intro[k]]));
  const saved = layouts[to];
  delete layouts[to];
  if (keepKeys) for (const k of Object.keys(layouts)) if (k !== 'auto' && !keepKeys.includes(k)) delete layouts[k];
  const blank = createIntro();
  return {
    ...intro,
    ...(img
      ? { imageId: img.imageId, imageUrl: img.url, thumbUrl: img.thumbUrl, imageWidth: img.width, imageHeight: img.height }
      : { imageId: null, imageUrl: null, thumbUrl: null, imageWidth: null, imageHeight: null }),
    textElements: saved?.textElements || [],
    overlayColor: saved?.overlayColor ?? blank.overlayColor,
    overlayOpacity: saved?.overlayOpacity ?? blank.overlayOpacity,
    showFooter: saved?.showFooter, // undefined = default (cover only)
    layouts,
  };
}

export function createEmptyStory() {
  return {
    title: '',
    description: '',
    category: '',
    coverImage: null,
    status: 'draft',
    intro: createIntro(),
    scenes: [],
  };
}

/** Deep clone a scene with fresh ids (scene duplication). */
export function cloneScene(scene) {
  const copy = JSON.parse(JSON.stringify(scene));
  copy.sceneId = uid('scene');
  copy.animationSteps = copy.animationSteps.map((s) => ({
    ...s,
    stepId: uid('step'),
    textElements: s.textElements.map((t) => ({ ...t, id: uid('txt') })),
  }));
  return copy;
}

/** Collect every image id a story references. */
export function collectImageIds(story) {
  const ids = new Set();
  if (story.coverImage?.imageId) ids.add(story.coverImage.imageId);
  if (story.intro?.imageId) ids.add(story.intro.imageId);
  (story.scenes || []).forEach((s) => s.imageId && ids.add(s.imageId));
  return [...ids];
}

/**
 * Points image references at new files: `changes` maps an old image id to
 * { imageId, url, thumbUrl } (e.g. after the server filed an upload into the story's
 * folder, or copied a shared image). Returns a new story; untouched parts are reused.
 */
export function relinkImages(story, changes) {
  if (!story || !changes || !Object.keys(changes).length) return story;
  const ref = (r) => {
    const c = r?.imageId && changes[r.imageId];
    return c ? { ...r, imageId: c.imageId, url: c.url, thumbUrl: c.thumbUrl } : r;
  };
  const framed = (r) => {
    const c = r?.imageId && changes[r.imageId];
    return c ? { ...r, imageId: c.imageId, imageUrl: c.url, thumbUrl: c.thumbUrl } : r;
  };
  const out = { ...story };
  if (story.coverImage) out.coverImage = ref(story.coverImage);
  if (story.thumbnail) out.thumbnail = ref(story.thumbnail);
  if (story.intro) {
    out.intro = framed(story.intro);
    // Saved per-background intro layouts are keyed by image id: follow the new ids.
    const layouts = story.intro.layouts;
    if (layouts && Object.keys(layouts).some((k) => changes[k] && changes[k].imageId !== k)) {
      out.intro = {
        ...out.intro,
        layouts: Object.fromEntries(Object.entries(layouts).map(([k, v]) => [changes[k]?.imageId || k, v])),
      };
    }
  }
  if (story.scenes) out.scenes = story.scenes.map(framed);
  return out;
}

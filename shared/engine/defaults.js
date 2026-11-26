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

/*
 * Image credits: the cover keeps its own on coverImage.credit, each scene on scene.imageCredit.
 * A credit belongs to the picture, so when the same image is used in several places the first
 * non-empty credit for that image id is used everywhere (e.g. a scene image picked as cover).
 */
export const IMAGE_CREDIT_MAX = 1000;

export function imageCreditFor(story, imageId) {
  if (!story || !imageId) return '';
  const clean = (t) => (typeof t === 'string' ? t.trim() : '');
  if (story.coverImage?.imageId === imageId && clean(story.coverImage.credit)) return clean(story.coverImage.credit);
  const scene = (story.scenes || []).find((s) => s.imageId === imageId && clean(s.imageCredit));
  return scene ? clean(scene.imageCredit) : '';
}

/** Credit shown on a scene: its own, else the credit given to the same picture elsewhere. */
export function sceneImageCredit(story, scene) {
  const own = typeof scene?.imageCredit === 'string' ? scene.imageCredit.trim() : '';
  return own || imageCreditFor(story, scene?.imageId);
}

/** Image id of the picture the intro shows (its own choice, else the cover, else scene 1). */
export function introImageId(story) {
  return story?.intro?.imageId || story?.coverImage?.imageId || story?.scenes?.[0]?.imageId || null;
}

/**
 * Sets the credit of a picture (on a story draft): on the cover when the cover is that picture,
 * otherwise on the scenes that use it. Used by the intro editor's (i) button.
 */
export function setImageCredit(story, imageId, text) {
  if (!story || !imageId) return;
  if (story.coverImage?.imageId === imageId) {
    story.coverImage.credit = text;
    return;
  }
  (story.scenes || []).forEach((s) => { if (s.imageId === imageId) s.imageCredit = text; });
}

/**
 * The credit text exactly as stored where setImageCredit writes it, for an edit box. Not
 * trimmed (trimming while typing would swallow every space typed at the end).
 */
export function editableImageCredit(story, imageId) {
  if (!story || !imageId) return '';
  if (story.coverImage?.imageId === imageId) return story.coverImage.credit ?? imageCreditFor(story, imageId);
  const scene = (story.scenes || []).find((s) => s.imageId === imageId);
  return scene?.imageCredit ?? imageCreditFor(story, imageId);
}

/** Credit of the picture the intro shows (its own choice, else the cover, else scene 1). */
export function introImageCredit(story) {
  return imageCreditFor(story, introImageId(story));
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

const INTRO_LOOK = ['textElements', 'overlayColor', 'overlayOpacity', 'showFooter', 'crop'];

/**
 * Cover crop: the part of the intro image the admin chose, as a box in fractions of the image
 *   { x, y, w, h }   0..1 (x/y = top-left corner, w/h = size); the whole image = { 0, 0, 1, 1 }
 *   aspect           screen shape (width / height) the editor stage had (to reopen at that shape)
 * The box is free: its edges move on their own. On screen exactly the box is shown, centred and
 * as large as fits; any room left (box shape ≠ screen shape) gets a blurred copy of the picture.
 * Stories without a crop simply cover the screen with the image, as before.
 * Crops saved by the first version ({ x, y, zoom }) are converted when read.
 */
export const INTRO_CROP_MIN = 0.05; // smallest box: 5% of the image width / height

const clampN = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
const FULL = Object.freeze({ x: 0, y: 0, w: 1, h: 1 });

/** Saved crop → box { x, y, w, h } (fractions of the image). iw/ih only matter for old crops. */
export function introCropBox(crop, iw, ih) {
  if (!crop) return { ...FULL };
  if (crop.w == null && crop.h == null) {
    // First version: a screen-shaped window anchored at x/y with a zoom.
    const zoom = clampN(num(crop.zoom, 1), 1, 4);
    if (!(iw > 0 && ih > 0)) return { ...FULL };
    const aspect = num(crop.aspect, 16 / 9) || 16 / 9;
    const wPx = Math.min(iw, aspect * ih) / zoom;
    const hPx = wPx / aspect;
    return introCropBox({
      x: (clampN(num(crop.x, 0.5), 0, 1) * (iw - wPx)) / iw,
      y: (clampN(num(crop.y, 0.5), 0, 1) * (ih - hPx)) / ih,
      w: wPx / iw,
      h: hPx / ih,
    });
  }
  const w = clampN(num(crop.w, 1), INTRO_CROP_MIN, 1);
  const h = clampN(num(crop.h, 1), INTRO_CROP_MIN, 1);
  return { x: clampN(num(crop.x, 0), 0, 1 - w), y: clampN(num(crop.y, 0), 0, 1 - h), w, h };
}

/** True when nothing is cropped (no saved crop, or the box is the whole image). */
export function isDefaultIntroCrop(crop) {
  if (!crop) return true;
  if (crop.w == null && crop.h == null) return num(crop.zoom, 1) === 1 && num(crop.x, 0.5) === 0.5 && num(crop.y, 0.5) === 0.5;
  const b = introCropBox(crop);
  return b.w >= 0.999 && b.h >= 0.999;
}

/** Moves the box by (dx, dy) fractions of the image; it stays inside the image. */
export function moveCropBox(box, dx, dy) {
  const b = introCropBox(box);
  return { ...b, x: clampN(b.x + dx, 0, 1 - b.w), y: clampN(b.y + dy, 0, 1 - b.h) };
}

/**
 * Resizes the box from a handle ('n','s','e','w','ne','nw','se','sw') dragged by (dx, dy)
 * fractions of the image. Each edge moves on its own: top/bottom change only the height,
 * left/right only the width, corners both. The opposite edges stay put.
 */
export function resizeCropBox(box, handle, dx, dy) {
  const b = introCropBox(box);
  let { x, y, w, h } = b;
  if (handle.includes('e')) w = clampN(b.w + dx, INTRO_CROP_MIN, 1 - b.x);
  if (handle.includes('w')) { x = clampN(b.x + dx, 0, b.x + b.w - INTRO_CROP_MIN); w = b.x + b.w - x; }
  if (handle.includes('s')) h = clampN(b.h + dy, INTRO_CROP_MIN, 1 - b.y);
  if (handle.includes('n')) { y = clampN(b.y + dy, 0, b.y + b.h - INTRO_CROP_MIN); h = b.y + b.h - y; }
  return { x, y, w, h };
}

/** Scales the box around its middle (factor > 1 = closer), keeping its shape where it can. */
export function zoomCropBox(box, factor) {
  const b = introCropBox(box);
  const w = clampN(b.w / factor, INTRO_CROP_MIN, 1);
  const h = clampN(b.h / factor, INTRO_CROP_MIN, 1);
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  return { x: clampN(cx - w / 2, 0, 1 - w), y: clampN(cy - h / 2, 0, 1 - h), w, h };
}

/**
 * Turns the box into the screen shape (width / height = aspect) around its middle, as large as
 * it can be without growing past its current width or height. Then it fills that screen exactly.
 */
export function fitCropBoxToShape(box, iw, ih, aspect) {
  const b = introCropBox(box, iw, ih);
  if (!(iw > 0 && ih > 0 && aspect > 0)) return b;
  // Box size in image pixels with the screen's shape, fitting inside the current box.
  let wPx = Math.min(b.w * iw, b.h * ih * aspect);
  wPx = Math.max(wPx, INTRO_CROP_MIN * Math.max(iw, ih * aspect));
  wPx = Math.min(wPx, iw, ih * aspect);
  const w = wPx / iw;
  const h = wPx / aspect / ih;
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  return { x: clampN(cx - w / 2, 0, 1 - w), y: clampN(cy - h / 2, 0, 1 - h), w, h };
}

/**
 * How to show the crop box on a W × H screen: exactly the box, as large as fits, centred,
 * never stretched. Nothing outside the box shows; when the box shape differs from the screen
 * the rest of the screen is left for a soft fill (IntroBackdrop blurs the picture there).
 * Returns screen pixels: `frame` = where the box sits, `image` = the whole image inside it.
 */
export function introCropView(crop, iw, ih, W, H) {
  const b = introCropBox(crop, iw, ih);
  const s = Math.min(W / (b.w * iw), H / (b.h * ih));
  const fw = b.w * iw * s;
  const fh = b.h * ih * s;
  return {
    frame: { left: (W - fw) / 2, top: (H - fh) / 2, width: fw, height: fh },
    image: { left: -b.x * iw * s, top: -b.y * ih * s, width: iw * s, height: ih * s },
    fillsScreen: Math.abs(fw - W) < 1 && Math.abs(fh - H) < 1,
  };
}

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
    crop: saved?.crop, // undefined = centred default
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

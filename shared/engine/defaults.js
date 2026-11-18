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
    transitionSettings: { easing: 'power2.inOut', duration: 1, blur: 0 },
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

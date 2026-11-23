import {
  END_CARD_LENGTH,
  REFERENCE_SCROLL_LENGTH,
  INTRO_EXIT_LENGTH,
  INTRO_SLIDE_LENGTH,
  OPENING_LENGTH,
  SCROLL_LENGTH_MAX,
  SCROLL_LENGTH_MIN,
} from './constants.js';
import { clamp } from './easing.js';
import { hasOpening } from './camera.js';

/**
 * A scene's scroll lengths (viewport heights): `steps` is its scroll length (the zoom speed
 * set in the builder); `opening` is the whole-image shot before step 1, which slows down and
 * speeds up together with the steps (1.2 at the reference length of 3).
 */
export function sceneLengths(scene) {
  const steps = clamp(Number(scene?.scrollLength) || REFERENCE_SCROLL_LENGTH, SCROLL_LENGTH_MIN, SCROLL_LENGTH_MAX);
  const opening = hasOpening(scene) ? OPENING_LENGTH * clamp(steps / REFERENCE_SCROLL_LENGTH, 0.75, 2.5) : 0;
  return { steps, opening };
}

/**
 * Lays the whole story out on one scroll axis, in viewport heights:
 * intro exit → scene 0 → transition → scene 1 → … → end card.
 * introExit: 'fade' (intro fades away) or 'slideOver' (scene 1 scrolls up over it).
 */
export function buildLayout(scenes = [], introExit = 'fade') {
  const segments = [];
  let t = 0;
  const introLength = introExit === 'slideOver' ? INTRO_SLIDE_LENGTH : INTRO_EXIT_LENGTH;
  segments.push({ type: 'intro', start: t, length: introLength, kind: introExit });
  t += introLength;
  scenes.forEach((scene, i) => {
    // `opening` (inside `length`) is the whole-image shot before step 1; steps play after it.
    const { steps: stepsLength, opening } = sceneLengths(scene);
    const length = opening + stepsLength;
    segments.push({ type: 'scene', index: i, start: t, length, opening });
    t += length;
    if (i < scenes.length - 1) {
      const tr = scene.transition || {};
      const tl = clamp(Number(tr.duration) || 0.8, 0.2, 2);
      segments.push({ type: 'transition', from: i, to: i + 1, kind: tr.type || 'crossfade', start: t, length: tl });
      t += tl;
    }
  });
  segments.push({ type: 'end', start: t, length: END_CARD_LENGTH });
  t += END_CARD_LENGTH;
  return { segments, total: t };
}

/** Which scene is on screen at a timeline position (viewport-height units). */
export function sceneIndexAt(layout, pos) {
  let idx = 0;
  for (const seg of layout.segments) {
    if (seg.type === 'scene' && pos >= seg.start) idx = seg.index;
    if (seg.type === 'transition' && pos >= seg.start + seg.length / 2) idx = seg.to;
  }
  return idx;
}

/** Reference stage (px) that all text "design units" are relative to. */
export const REFERENCE_WIDTH = 1920;
export const REFERENCE_HEIGHT = 1080;

/**
 * Pixels per design unit for a stage. Uses the tighter of width and height so text keeps
 * its layout on ultrawide or short screens instead of outgrowing them. Identical on 16:9.
 */
export function stageUnit(width, height) {
  if (!width) return 1;
  if (!height) return width / REFERENCE_WIDTH;
  return Math.min(width / REFERENCE_WIDTH, height / REFERENCE_HEIGHT);
}

export const ZOOM_MIN = 1;
export const ZOOM_MAX = 3;
export const ZOOM_PRESETS = [1, 1.5, 2, 2.5, 3];

/** A scene's scroll length (viewport heights) sets its zoom speed: longer = slower, smoother. */
export const SCROLL_LENGTH_MIN = 1;
export const SCROLL_LENGTH_MAX = 12;
/** For new scenes. (Older scenes without a value fall back to REFERENCE_SCROLL_LENGTH.) */
export const DEFAULT_SCROLL_LENGTH = 5;
export const REFERENCE_SCROLL_LENGTH = 3;
/** Quick picks in the builder (viewport heights of scrolling for the scene's steps). */
export const ZOOM_SPEED_PRESETS = [
  { value: 2, label: 'Fast' },
  { value: 3, label: 'Normal' },
  { value: 5, label: 'Slow' },
  { value: 8, label: 'Very slow' },
];

/** Viewport heights used by the fixed parts of the story timeline. */
export const INTRO_EXIT_LENGTH = 0.8;
/** Slide-over moves exactly one screen per screen of scrolling, like a normal page. */
export const INTRO_SLIDE_LENGTH = 1;
export const END_CARD_LENGTH = 0.8;
/** Scroll (viewport heights) before a scene's first step at the reference speed: the whole
 *  image is shown, then the camera zooms into step 1. It scales with the scene's speed
 *  (see sceneLengths). Scenes can turn it off with openWithFullImage: false. */
export const OPENING_LENGTH = 1.2;
/** Share of the opening spent resting on the whole image before the zoom starts. */
export const OPENING_HOLD = 0.3;

export const STORY_STATUSES = ['draft', 'active', 'inactive'];

export const ANIMATION_TYPES = [
  { value: 'slideUp', label: 'Bottom to top' },
  { value: 'slideDown', label: 'Top to bottom' },
  { value: 'slideRight', label: 'Left to right' },
  { value: 'slideLeft', label: 'Right to left' },
  { value: 'fadeIn', label: 'Fade in' },
  { value: 'scaleIn', label: 'Scale in' },
];

export const TRANSITION_TYPES = [
  { value: 'slideOver', label: 'Slide over (page scroll)' },
  { value: 'crossfade', label: 'Crossfade' },
  { value: 'fadeBlack', label: 'Fade through black' },
  { value: 'slideUp', label: 'Slide up' },
  { value: 'zoomThrough', label: 'Zoom through' },
];

export const FONT_FAMILIES = [
  { value: 'Inter Variable', label: 'Inter' },
  { value: 'Playfair Display Variable', label: 'Playfair Display' },
  { value: 'Montserrat Variable', label: 'Montserrat' },
  { value: 'Lora Variable', label: 'Lora' },
  { value: 'Oswald Variable', label: 'Oswald' },
  { value: 'Space Grotesk Variable', label: 'Space Grotesk' },
  { value: 'Cormorant Garamond Variable', label: 'Cormorant Garamond' },
  { value: 'Bebas Neue', label: 'Bebas Neue' },
];

export const FONT_WEIGHTS = [300, 400, 500, 600, 700, 800];

/** Stage aspect ratios offered in the editors. Viewer uses the real window. */
export const STAGE_ASPECTS = [
  { value: 16 / 9, label: '16:9' },
  { value: 16 / 10, label: '16:10' },
  { value: 21 / 9, label: '21:9' },
  { value: 4 / 3, label: '4:3' },
];

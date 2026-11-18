import { OPENING_HOLD, ZOOM_MAX, ZOOM_MIN } from './constants.js';
import { clamp, clamp01, getEase, lerp } from './easing.js';

// `contain` (0–1) blends the base scale from "fill the screen" (0) to "show the whole image" (1).
const DEFAULT_CAMERA = Object.freeze({ zoom: 1, contain: 0, fx: 0.5, fy: 0.5, tx: 0.5, ty: 0.5, blur: 0 });

/** Whether a scene opens on its whole image before zooming into its first step. */
export function hasOpening(scene) {
  return !!scene && scene.openWithFullImage !== false && (scene.animationSteps || []).length > 0;
}

export function sortSteps(steps = []) {
  return [...steps].sort((a, b) => a.progress - b.progress);
}

function stepCamera(step) {
  const fp = step.focalPoint || {};
  return {
    zoom: clamp(Number(step.zoomLevel) || 1, ZOOM_MIN, ZOOM_MAX),
    fx: clamp01(fp.x ?? 0.5),
    fy: clamp01(fp.y ?? 0.5),
    tx: clamp01(fp.targetPositionX ?? 0.5),
    ty: clamp01(fp.targetPositionY ?? 0.5),
    contain: 0,
    blur: 0,
  };
}

/**
 * Opening shot, t = 0–1: rest on the whole image, then zoom straight into step 1's
 * focal point (it keeps its screen position while the image grows around it).
 */
function openingCamera(first, t) {
  const end = stepCamera(first);
  const m = clamp01((t - OPENING_HOLD) / (1 - OPENING_HOLD));
  const e = getEase(first.transitionSettings?.easing || 'power2.inOut')(m);
  return {
    ...end,
    zoom: Math.exp(lerp(0, Math.log(end.zoom), e)),
    contain: 1 - e,
    blur: clamp(Number(first.transitionSettings?.blur) || 0, 0, 30) * Math.sin(Math.PI * m),
  };
}

/**
 * Camera parameters (zoom + focal point + where it lands on screen) for a scene at
 * scroll progress p (0–1). Interpolates between the two surrounding steps; zoom is
 * interpolated in log space so the zoom speed feels constant. `blur` (px on a 1920 screen)
 * rises and falls during a move when the destination step asks for motion blur.
 * Pass `presorted = true` when steps are already sorted by progress (hot path).
 */
export function cameraAt(steps, p, presorted = false) {
  const sorted = presorted ? steps || [] : sortSteps(steps);
  if (!sorted.length) return { ...DEFAULT_CAMERA };
  // Negative progress is the scene's opening (-1 = whole image … 0 = step 1).
  if (p < 0) return openingCamera(sorted[0], clamp01(p + 1));
  if (p <= sorted[0].progress) return stepCamera(sorted[0]);
  const last = sorted[sorted.length - 1];
  if (p >= last.progress) return stepCamera(last);

  let k = 0;
  while (k < sorted.length - 2 && p >= sorted[k + 1].progress) k += 1;
  const a = sorted[k];
  const b = sorted[k + 1];
  const gap = b.progress - a.progress;
  if (gap <= 0) return stepCamera(b);

  const share = clamp(Number(b.transitionSettings?.duration ?? 1), 0.05, 1);
  const moveLen = gap * share;
  const moveStart = b.progress - moveLen;
  const t = p <= moveStart ? 0 : clamp01((p - moveStart) / moveLen);
  const e = getEase(b.transitionSettings?.easing || 'power2.inOut')(t);

  const ca = stepCamera(a);
  const cb = stepCamera(b);
  return {
    zoom: Math.exp(lerp(Math.log(ca.zoom), Math.log(cb.zoom), e)),
    fx: lerp(ca.fx, cb.fx, e),
    fy: lerp(ca.fy, cb.fy, e),
    tx: lerp(ca.tx, cb.tx, e),
    ty: lerp(ca.ty, cb.ty, e),
    // Peaks mid-move, zero when the camera rests — like a lens refocusing on the next detail.
    blur: clamp(Number(b.transitionSettings?.blur) || 0, 0, 30) * Math.sin(Math.PI * t),
  };
}

function axis(target, focal, imageSize, viewSize) {
  // Image smaller than the viewport on this axis: center it.
  if (imageSize <= viewSize) return (viewSize - imageSize) / 2;
  // Put the focal point on its target, then keep the image covering the viewport.
  const pos = target * viewSize - focal * imageSize;
  return clamp(pos, viewSize - imageSize, 0);
}

/**
 * Converts camera parameters into a CSS transform for an element of the image's
 * natural size with transform-origin 0 0:  translate3d(x, y, 0) scale(scale).
 */
export function cameraTransform(camera, imageW, imageH, viewW, viewH, fit = 'cover') {
  if (!imageW || !imageH || !viewW || !viewH) return { x: 0, y: 0, scale: 1 };
  const containBase = Math.min(viewW / imageW, viewH / imageH);
  const coverBase = fit === 'contain' ? containBase : Math.max(viewW / imageW, viewH / imageH);
  const c = clamp01(camera.contain || 0);
  const base = c ? Math.exp(lerp(Math.log(coverBase), Math.log(containBase), c)) : coverBase;
  const scale = base * camera.zoom;
  const w = imageW * scale;
  const h = imageH * scale;
  return {
    x: axis(camera.tx, camera.fx, w, viewW),
    y: axis(camera.ty, camera.fy, h, viewH),
    scale,
  };
}

/** The part of the image (normalized 0–1 rect) that is visible for a transform. */
export function visibleRegion(transform, imageW, imageH, viewW, viewH) {
  const { x, y, scale } = transform;
  const left = clamp01(-x / scale / imageW);
  const top = clamp01(-y / scale / imageH);
  const right = clamp01((viewW - x) / scale / imageW);
  const bottom = clamp01((viewH - y) / scale / imageH);
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/** Where (normalized viewport coords) an image point ends up after the transform. */
export function projectPoint(transform, imageW, imageH, viewW, viewH, px, py) {
  return {
    x: (transform.x + px * imageW * transform.scale) / viewW,
    y: (transform.y + py * imageH * transform.scale) / viewH,
  };
}

export function transformToCss({ x, y, scale }) {
  return `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) scale(${scale.toFixed(5)})`;
}

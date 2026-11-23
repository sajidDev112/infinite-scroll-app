import { clamp01, getEase } from './easing.js';
import { sortSteps } from './camera.js';

/** Last moment (scene progress) a step's text may start revealing, so the final
 *  step's text (often at 100%) is still fully shown before the scene ends. */
export const LATEST_TEXT_START = 0.88;
const SLIDE_Y = 90; // design units
const SLIDE_X = 140;

/**
 * Offsets for an animation type at reveal amount e (0 = hidden, 1 = settled).
 * x/y are design units (scaled by --u when rendered).
 */
export function enterOffset(type, e) {
  const r = 1 - e;
  switch (type) {
    case 'slideDown': return { x: 0, y: -SLIDE_Y * r, scale: 1 };
    case 'slideRight': return { x: -SLIDE_X * r, y: 0, scale: 1 };
    case 'slideLeft': return { x: SLIDE_X * r, y: 0, scale: 1 };
    case 'fadeIn': return { x: 0, y: 0, scale: 1 };
    case 'scaleIn': return { x: 0, y: 0, scale: 0.82 + 0.18 * e };
    case 'slideUp':
    default: return { x: 0, y: SLIDE_Y * r, scale: 1 };
  }
}

/** Exit continues the motion direction, shorter and subtler. */
function exitOffset(type, x) {
  switch (type) {
    case 'slideDown': return { x: 0, y: 40 * x, scale: 1 };
    case 'slideRight': return { x: 60 * x, y: 0, scale: 1 };
    case 'slideLeft': return { x: -60 * x, y: 0, scale: 1 };
    case 'fadeIn': return { x: 0, y: 0, scale: 1 };
    case 'scaleIn': return { x: 0, y: 0, scale: 1 + 0.06 * x };
    case 'slideUp':
    default: return { x: 0, y: -40 * x, scale: 1 };
  }
}

/**
 * For each step (sorted by progress) the scroll window during which its text is shown.
 * Returns [{ step, start, end, isLast }].
 */
export function textWindows(steps) {
  const sorted = sortSteps(steps);
  return sorted.map((step, i) => {
    const start = Math.min(step.progress, LATEST_TEXT_START);
    const next = sorted[i + 1];
    const end = next ? Math.min(next.progress, LATEST_TEXT_START) : 1;
    return { step, start, end: Math.max(end, start), isLast: !next };
  });
}

/**
 * Scroll-driven state of one text element at scene progress p.
 * Returns { opacity, x, y, scale } with x/y in design units.
 */
export function textStateAt(text, win, p) {
  const dur = Math.max(0.01, Number(text.animationDuration) || 0.1);
  const delay = Math.max(0, Number(text.animationDelay) || 0);
  const inStart = Math.min(win.start + delay, 1 - dur);
  const e = getEase(text.easing || 'power2.out')(clamp01((p - inStart) / dur));
  const base = text.opacity ?? 1;

  let exit = 0;
  if (!text.persist && !win.isLast) {
    const exitDur = dur * 0.75;
    const outStart = Math.max(inStart + dur, win.end - exitDur);
    const len = Math.max(0.001, win.end - outStart);
    exit = getEase('power2.in')(clamp01((p - outStart) / len));
  }

  if (exit > 0) {
    const o = exitOffset(text.animationType, exit);
    return { opacity: base * e * (1 - exit), ...o };
  }
  return { opacity: base * e, ...enterOffset(text.animationType, e) };
}

/** Fully settled state, used by editors to show a step's text statically. */
export function settledState(text) {
  return { opacity: text.opacity ?? 1, x: 0, y: 0, scale: 1 };
}

export function hexToRgba(hex, alpha = 1) {
  let h = String(hex || '#000000').replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  if (Number.isNaN(n)) return `rgba(0,0,0,${alpha})`;
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

const u = (n) => `calc(var(--u, 1px) * ${Number(n) || 0})`;

/** Absolute placement of a text element on the stage (outer wrapper). */
export function textWrapperStyle(t) {
  const style = {
    position: 'absolute',
    left: `${(t.positionX ?? 0) * 100}%`,
    top: `${(t.positionY ?? 0) * 100}%`,
    zIndex: t.zIndex ?? 1,
  };
  if (t.width > 0) style.width = `${t.width * 100}%`;
  else style.maxWidth = `${(1 - (t.positionX ?? 0)) * 100}%`;
  if (t.height > 0) style.height = `${t.height * 100}%`;
  return style;
}

/** Visual style of the text box itself (inner element). Units scale with the stage. */
export function textBoxStyle(t) {
  const style = {
    boxSizing: 'border-box',
    width: t.width > 0 ? '100%' : 'max-content',
    maxWidth: '100%',
    height: t.height > 0 ? '100%' : 'auto',
    // Inter is the fallback while an uploaded font loads, or if it was deleted.
    fontFamily: `'${t.fontFamily || 'Inter Variable'}', 'Inter Variable', system-ui, sans-serif`,
    fontSize: u(t.fontSize ?? 48),
    fontWeight: t.fontWeight ?? 600,
    fontStyle: t.fontStyle || 'normal',
    textDecoration: t.textDecoration || 'none',
    letterSpacing: `${t.letterSpacing ?? 0}em`,
    lineHeight: t.lineHeight ?? 1.2,
    textAlign: t.textAlignment || 'left',
    textTransform: t.textTransform || 'none',
    color: t.color || '#ffffff',
    padding: u(t.padding ?? 0),
    borderRadius: u(t.borderRadius ?? 0),
    whiteSpace: 'pre-wrap',
    overflowWrap: 'break-word',
    transform: t.rotation ? `rotate(${t.rotation}deg)` : undefined,
  };
  const bgAlpha = t.backgroundOpacity ?? 1;
  if (t.backgroundType === 'solid') {
    style.background = hexToRgba(t.backgroundColor, bgAlpha);
  } else if (t.backgroundType === 'gradient') {
    const g = t.backgroundGradient || {};
    style.background = `linear-gradient(${g.angle ?? 135}deg, ${hexToRgba(g.from || '#6366f1', bgAlpha)}, ${hexToRgba(g.to || '#a855f7', bgAlpha)})`;
  }
  if (t.borderWidth > 0) style.border = `${u(t.borderWidth)} solid ${t.borderColor || '#ffffff'}`;
  if (t.shadow?.enabled) {
    const s = t.shadow;
    style.textShadow = `${u(s.x ?? 0)} ${u(s.y ?? 2)} ${u(s.blur ?? 12)} ${s.color || 'rgba(0,0,0,0.6)'}`;
  }
  return style;
}

/** CSS transform string for an animated state, given the px-per-unit of the stage. */
export function stateTransform(state, unitPx) {
  return `translate3d(${(state.x * unitPx).toFixed(2)}px, ${(state.y * unitPx).toFixed(2)}px, 0) scale(${state.scale.toFixed(4)})`;
}

/**
 * Motion blur on the image layer (not the text). A tiny scale-up while blurred hides the
 * soft edges a blur would otherwise pull in from outside the screen.
 */
export function applyLens(el, blur, unit) {
  if (!el) return;
  const px = (blur || 0) * unit;
  if (px < 0.25) {
    if (el.style.filter) {
      el.style.filter = '';
      el.style.transform = '';
    }
    return;
  }
  el.style.filter = `blur(${px.toFixed(2)}px)`;
  el.style.transform = `scale(${(1 + Math.min(0.06, px / 300)).toFixed(4)})`;
}

/** CSS background for the soft backdrop behind a scene image that doesn't fill the screen. */
export function backdropStyle(scene) {
  const src = scene?.thumbUrl || scene?.imageUrl;
  return src ? { backgroundImage: `url(${JSON.stringify(src)})` } : undefined;
}

/**
 * The backdrop shows wherever the image leaves the screen uncovered: during a scene's
 * whole-image opening, and always for "Show whole image" scenes. Never plain black.
 */
export function backdropOpacity(scene, camera) {
  if (scene?.fit === 'contain') return 1;
  return Math.max(0, Math.min(1, camera?.contain || 0));
}

export function applyBackdrop(el, scene, camera) {
  if (!el) return;
  const o = backdropOpacity(scene, camera);
  el.style.opacity = o.toFixed(3);
  el.style.visibility = o < 0.002 ? 'hidden' : 'visible';
}

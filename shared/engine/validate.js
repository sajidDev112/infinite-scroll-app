import { ZOOM_MAX, ZOOM_MIN } from './constants.js';

const in01 = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;

/**
 * Checks that a story can be published. Returns a list of
 * { path, message } problems; an empty list means it is publishable.
 */
export function validateForPublish(story) {
  const errors = [];
  const add = (path, message) => errors.push({ path, message });

  if (!story?.title?.trim()) add('title', 'Story title is required.');
  const scenes = story?.scenes || [];
  if (!scenes.length) add('scenes', 'Add at least one scene (story image).');

  const intro = story?.intro;
  (intro?.textElements || []).forEach((t, i) => {
    if (!String(t.content || '').trim()) add(`intro.text.${i}`, `Introduction text ${i + 1} is empty.`);
  });

  scenes.forEach((scene, si) => {
    const label = `Scene ${si + 1}`;
    if (!scene.imageUrl || !scene.imageId) add(`scenes.${si}.image`, `${label} has no image.`);
    if (!(scene.imageWidth > 0 && scene.imageHeight > 0)) add(`scenes.${si}.image`, `${label} is missing image dimensions.`);
    const steps = scene.animationSteps || [];
    if (!steps.length) add(`scenes.${si}.steps`, `${label} needs at least one animation step.`);

    const seen = new Set();
    steps.forEach((step, k) => {
      const sl = `${label}, step ${k + 1}`;
      if (!in01(step.progress)) add(`scenes.${si}.steps.${k}.progress`, `${sl}: scroll progress must be 0–100%.`);
      const key = Math.round(step.progress * 1000);
      if (seen.has(key)) add(`scenes.${si}.steps.${k}.progress`, `${sl}: another step already uses ${Math.round(step.progress * 100)}%.`);
      seen.add(key);
      const z = step.zoomLevel;
      if (!(typeof z === 'number' && z >= ZOOM_MIN && z <= ZOOM_MAX)) add(`scenes.${si}.steps.${k}.zoom`, `${sl}: zoom must be between ${ZOOM_MIN}x and ${ZOOM_MAX}x.`);
      const fp = step.focalPoint || {};
      if (![fp.x, fp.y, fp.targetPositionX, fp.targetPositionY].every(in01)) {
        add(`scenes.${si}.steps.${k}.focal`, `${sl}: focal point must be inside the image.`);
      }
      (step.textElements || []).forEach((t, ti) => {
        if (!String(t.content || '').trim()) add(`scenes.${si}.steps.${k}.text.${ti}`, `${sl}: text ${ti + 1} is empty.`);
      });
    });
  });

  return errors;
}

import { useMemo } from 'react';
import { stageUnit } from '../engine/constants.js';
import { cameraAt, cameraTransform, sortSteps, transformToCss } from '../engine/camera.js';
import { textStateAt, textWindows } from '../engine/text.js';
import { TextElementView } from './TextElementView.jsx';
import { applyBackdrop, applyLens, backdropStyle } from './lens.js';

/**
 * Static render of a scene at a given scroll progress, at an explicit stage size.
 * Used by the editors; produces the same pixels as the StoryPlayer at that progress.
 *
 * mode 'play'  → camera + all text exactly as the viewer shows at `progress`.
 * mode 'edit'  → camera at `progress`, text supplied by `renderText` (editor handles drag).
 */
export function SceneFrame({ scene, progress = 0, width, height, mode = 'play', textLayer = null, className = '' }) {
  const unitPx = stageUnit(width, height);
  const steps = useMemo(() => sortSteps(scene?.animationSteps || []), [scene?.animationSteps]);
  const windows = useMemo(() => textWindows(steps), [steps]);

  if (!scene || !width || !height) return null;
  const cam = cameraAt(steps, progress, true);
  const tr = cameraTransform(cam, scene.imageWidth, scene.imageHeight, width, height, scene.fit);

  return (
    <div
      className={`sp-frame ${className}`}
      style={{ width, height, '--u': `${unitPx}px` }}
    >
      <div className="sp-backdrop" style={backdropStyle(scene)} ref={(el) => applyBackdrop(el, scene, cam)} aria-hidden="true" />
      <div className="sp-lens" ref={(el) => applyLens(el, cam.blur, unitPx)}>
        <div
          className="sp-cam"
          style={{ width: scene.imageWidth, height: scene.imageHeight, transform: transformToCss(tr) }}
        >
          {scene.thumbUrl && <img className="sp-img" src={scene.thumbUrl} alt="" draggable={false} />}
          {scene.imageUrl && <img className="sp-img" src={scene.imageUrl} alt="" draggable={false} />}
        </div>
      </div>
      <div className="sp-texts">
        {mode === 'play'
          ? windows.flatMap((win) =>
              (win.step.textElements || []).map((t) => (
                <TextElementView key={t.id} text={t} state={textStateAt(t, win, progress)} unitPx={unitPx} />
              )),
            )
          : textLayer}
      </div>
    </div>
  );
}

/** Intro background (image + overlay) shared by the intro editor and the player. */
export function IntroBackdrop({ intro, fallbackImage }) {
  const src = intro?.imageUrl || fallbackImage?.url || null;
  return (
    <>
      {src && <img className="sp-intro-img" src={src} alt="" draggable={false} />}
      <div
        className="sp-intro-overlay"
        style={{ background: intro?.overlayColor || '#000', opacity: intro?.overlayOpacity ?? 0.35 }}
      />
    </>
  );
}

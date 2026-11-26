import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { stageUnit } from '../engine/constants.js';
import { cameraAt, cameraTransform, sortSteps, transformToCss } from '../engine/camera.js';
import { textStateAt, textWindows } from '../engine/text.js';
import { TextElementView } from './TextElementView.jsx';
import { applyBackdrop, applyLens, backdropStyle } from './lens.js';
import { introCropView, isDefaultIntroCrop } from '../engine/defaults.js';

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
      <SceneOverlay scene={scene} />
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

/** The scene's own colour overlay (between the image and its text). Nothing when opacity is 0. */
export function SceneOverlay({ scene }) {
  const opacity = Number(scene?.overlayOpacity) || 0;
  if (opacity <= 0) return null;
  return <div className="sp-scene-overlay" style={{ background: scene.overlayColor || '#000', opacity }} aria-hidden="true" />;
}

/** Size of an element, kept up to date as it resizes. */
function useElementSize(ref) {
  const [size, setSize] = useState(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const read = () => setSize((s) => (s && s.w === el.clientWidth && s.h === el.clientHeight ? s : { w: el.clientWidth, h: el.clientHeight }));
    read();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

/**
 * Intro background (image + overlay) shared by the intro editor and the player.
 * With a crop (intro.crop, or `crop` to preview one) exactly the chosen box is shown, centred and
 * as large as fits; if its shape differs from the screen, a blurred copy of the picture fills
 * the rest. Without a crop the image simply covers the screen, as before.
 * `children` sit on the picture itself (their corners follow the crop), above the overlay.
 */
export function IntroBackdrop({ intro, fallbackImage, crop, children }) {
  const own = Boolean(intro?.imageUrl);
  const src = own ? intro.imageUrl : fallbackImage?.url || null;
  const box = crop ?? intro?.crop;
  const frameRef = useRef(null);
  const frame = useElementSize(frameRef);
  const [natural, setNatural] = useState(null);
  const iw = (own ? intro.imageWidth : fallbackImage?.width) || natural?.w;
  const ih = (own ? intro.imageHeight : fallbackImage?.height) || natural?.h;
  const view = !isDefaultIntroCrop(box) && iw && ih && frame?.w && frame?.h ? introCropView(box, iw, ih, frame.w, frame.h) : null;

  return (
    <>
      <div ref={frameRef} className="sp-intro-media">
        {src && !view && (
          <img
            className="sp-intro-img"
            src={src}
            alt=""
            draggable={false}
            onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
          />
        )}
        {src && view && (
          <>
            {!view.fillsScreen && <img className="sp-intro-img sp-intro-fill" src={src} alt="" draggable={false} aria-hidden="true" />}
            <div className="sp-intro-crop" style={view.frame}>
              <img
                className="sp-intro-crop-img"
                src={src}
                alt=""
                draggable={false}
                style={{ left: view.image.left, top: view.image.top, width: view.image.width, height: view.image.height }}
              />
            </div>
          </>
        )}
      </div>
      <div
        className="sp-intro-overlay"
        style={{ background: intro?.overlayColor || '#000', opacity: intro?.overlayOpacity ?? 0.35 }}
      />
      {children && <div className="sp-intro-frame" style={view ? view.frame : undefined}>{children}</div>}
    </>
  );
}

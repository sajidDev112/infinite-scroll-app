import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { Check, Crop, ImageOff, Monitor, Play, Plus, RotateCcw, Square } from 'lucide-react';
import { stageUnit } from '@shared/engine/constants.js';
import { createIntroText, fitCropBoxToShape, introCropBox, editableImageCredit, introCropView, introImageId, introShowsFooter, setImageCredit, isDefaultIntroCrop, moveCropBox, resizeCropBox, switchIntroImage, uid, zoomCropBox } from '@shared/engine/defaults.js';
import { enterOffset } from '@shared/engine/text.js';
import { IntroBackdrop } from '@shared/react/SceneFrame.jsx';
import { IntroFooter } from '@shared/react/IntroFooter.jsx';
import { TextElementView } from '@shared/react/TextElementView.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { ColorField, RangeField, Segmented, Toggle } from '../../components/ui/Fields.jsx';
import StageCanvas from './StageCanvas.jsx';
import CanvasCredit from './CanvasCredit.jsx';
import TextInspector from './TextInspector.jsx';
import LayerList from './LayerList.jsx';
import { PanelTabs, StageControls } from './EditorToolbar.jsx';
import { textOps } from './textOps.js';
import { cx } from '../../lib/utils.js';
import { useFooterSettings } from '../../hooks/useFooterSettings.js';

/** Plays the intro text animation inside the editor stage (same tween as the viewer). */
function IntroPlayback({ texts, width, height, onDone }) {
  const refs = useRef([]);
  const done = useRef(onDone);
  done.current = onDone;
  const unit = stageUnit(width, height);
  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      let end = 0;
      texts.forEach((t, k) => {
        const el = refs.current[k];
        if (!el) return;
        const from = enterOffset(t.animationType, 0);
        const duration = Math.max(0.05, Number(t.animationDuration) || 1);
        const delay = Math.max(0, Number(t.animationDelay) || 0);
        end = Math.max(end, duration + delay);
        gsap.fromTo(el, { opacity: 0, x: from.x * unit, y: from.y * unit, scale: from.scale }, { opacity: t.opacity ?? 1, x: 0, y: 0, scale: 1, duration, delay, ease: t.easing || 'power3.out' });
      });
      gsap.delayedCall(end + 0.8, () => done.current());
    });
    return () => ctx.revert();
  }, [texts, unit]);
  return (
    <div className="absolute inset-0">
      {texts.map((t, k) => (
        <TextElementView key={t.id} ref={(el) => (refs.current[k] = el)} text={t} unitPx={unit} style={{ opacity: 0, transform: 'none' }} />
      ))}
    </div>
  );
}

const HANDLES = [
  { id: 'nw', cls: 'left-0 top-0 size-3.5 cursor-nwse-resize' },
  { id: 'n', cls: 'left-1/2 top-0 h-1.5 w-9 cursor-ns-resize' },
  { id: 'ne', cls: 'left-full top-0 size-3.5 cursor-nesw-resize' },
  { id: 'e', cls: 'left-full top-1/2 h-9 w-1.5 cursor-ew-resize' },
  { id: 'se', cls: 'left-full top-full size-3.5 cursor-nwse-resize' },
  { id: 's', cls: 'left-1/2 top-full h-1.5 w-9 cursor-ns-resize' },
  { id: 'sw', cls: 'left-0 top-full size-3.5 cursor-nesw-resize' },
  { id: 'w', cls: 'left-0 top-1/2 h-9 w-1.5 cursor-ew-resize' },
];

/**
 * Crop mode: the whole image is shown with the crop box on top. Drag the box to move it;
 * the top/bottom handles change only its height, left/right only its width, corners both.
 * Scroll to zoom, arrow keys to nudge. Changes show live and are saved when the drag ends.
 * `crop` is the box in fractions of the image ({ x, y, w, h }).
 */
function CropLayer({ src, crop, iw: knownW, ih: knownH, aspect, onLive, onCommit }) {
  const ref = useRef(null);
  const [natural, setNatural] = useState(null);
  const iw = knownW || natural?.w || 0;
  const ih = knownH || natural?.h || 0;
  const live = useRef(crop);
  live.current = crop;
  const commitTimer = useRef(null);
  const geo = useRef(null);
  geo.current = { iw, ih, aspect, onLive, onCommit };

  // Whole image fitted inside the stage (stage = aspect × 1 units).
  const fit = iw && ih ? Math.min(aspect / iw, 1 / ih) : 0;
  const ox = (aspect - iw * fit) / 2;
  const oy = (1 - ih * fit) / 2;
  const b = iw && ih ? crop : null;
  const pct = (v) => `${(v * 100).toFixed(3)}%`;

  // Wheel zoom needs a non-passive listener so the stage does not scroll instead.
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      const g = geo.current;
      if (!g.iw || !g.ih) return;
      e.preventDefault();
      const next = zoomCropBox(live.current, Math.exp(-e.deltaY * 0.0015));
      live.current = next;
      g.onLive(next);
      clearTimeout(commitTimer.current);
      commitTimer.current = setTimeout(() => geo.current.onCommit(live.current), 250);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => { el.removeEventListener('wheel', onWheel); clearTimeout(commitTimer.current); };
  }, []);

  const startDrag = (e, handle) => {
    if (e.button !== 0 || !iw || !ih) return;
    e.stopPropagation();
    e.preventDefault();
    ref.current?.focus({ preventScroll: true });
    const pxPerImage = ref.current.getBoundingClientRect().height * fit; // screen px per image px
    const start = { x: e.clientX, y: e.clientY, crop: live.current };
    let changed = null;
    const move = (ev) => {
      // Pointer movement as a fraction of the image width / height.
      const dx = (ev.clientX - start.x) / (pxPerImage * iw);
      const dy = (ev.clientY - start.y) / (pxPerImage * ih);
      changed = handle === 'move' ? moveCropBox(start.crop, dx, dy) : resizeCropBox(start.crop, handle, dx, dy);
      geo.current.onLive(changed);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (changed) geo.current.onCommit(changed);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const onKeyDown = (e) => {
    if (!iw || !ih) return;
    const step = e.shiftKey ? 0.05 : 0.01;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (!d) return;
    e.preventDefault();
    onCommit(moveCropBox(live.current, d[0], d[1]));
  };

  return (
    <div
      ref={ref}
      tabIndex={0}
      role="application"
      aria-label="Crop the cover image: drag the box to move it, drag its edges to change its width or height, scroll to zoom, arrow keys to nudge"
      className="absolute inset-0 z-20 touch-none overflow-hidden bg-ink-950 outline-none"
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={onKeyDown}
    >
      <img
        src={src}
        alt=""
        draggable={false}
        className="pointer-events-none absolute inset-0 h-full w-full object-contain select-none"
        onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
      />
      {b && (
        <div
          className="absolute cursor-move outline outline-2 outline-accent-400 shadow-[0_0_0_9999px_rgba(5,6,10,0.62)]"
          style={{ left: pct((ox + b.x * iw * fit) / aspect), top: pct(oy + b.y * ih * fit), width: pct((b.w * iw * fit) / aspect), height: pct(b.h * ih * fit) }}
          onPointerDown={(e) => startDrag(e, 'move')}
        >
          {/* Rule-of-thirds guides */}
          <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
            {Array.from({ length: 9 }, (_, k) => <div key={k} className="border border-white/20" />)}
          </div>
          {HANDLES.map((h) => (
            <span
              key={h.id}
              data-handle={h.id}
              className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-sm border border-accent-500 bg-white shadow ${h.cls}`}
              onPointerDown={(e) => startDrag(e, h.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** Small frames showing the crop on other screen shapes (viewers' screens vary). */
function CropPreviews({ intro, fallback, crop }) {
  const frames = [{ label: 'Desktop', ratio: '16 / 9', w: 'w-[62%]' }, { label: 'Phone', ratio: '9 / 16', w: 'w-[26%]' }];
  return (
    <div className="flex items-end gap-3">
      {frames.map((f) => (
        <figure key={f.label} className={f.w}>
          <div className="relative overflow-hidden rounded-md bg-black ring-1 ring-ink-700" style={{ aspectRatio: f.ratio }}>
            <IntroBackdrop intro={intro} fallbackImage={fallback} crop={crop} />
          </div>
          <figcaption className="mt-1 text-center text-[11px] text-ink-400">{f.label}</figcaption>
        </figure>
      ))}
    </div>
  );
}

export default function StepIntro({ story, update, aspect, setAspect }) {
  const footer = useFooterSettings();
  const intro = story.intro;
  const texts = intro.textElements || [];
  const showFooter = introShowsFooter(story);
  const [selectedId, setSelectedId] = useState(null);
  const [tab, setTab] = useState('text');
  const [zoom, setZoom] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [focusSignal, setFocusSignal] = useState(0);
  const [cropping, setCropping] = useState(false);
  const [liveCrop, setLiveCrop] = useState(null); // while dragging / zooming, before it is saved
  const selected = texts.find((t) => t.id === selectedId) || null;

  const images = useMemo(() => {
    const list = [];
    const seen = new Set();
    const push = (ref, label) => {
      if (!ref?.imageId || seen.has(ref.imageId)) return;
      seen.add(ref.imageId);
      list.push({ ...ref, label });
    };
    push(story.coverImage, 'Cover');
    story.scenes.forEach((s, i) => push({ imageId: s.imageId, url: s.imageUrl, thumbUrl: s.thumbUrl, width: s.imageWidth, height: s.imageHeight }, `Scene ${i + 1}`));
    return list;
  }, [story.coverImage, story.scenes]);

  const fallback = story.coverImage || (story.scenes[0] && { url: story.scenes[0].imageUrl, width: story.scenes[0].imageWidth, height: story.scenes[0].imageHeight });
  const cropSrc = intro.imageUrl || fallback?.url || null;
  const cropW = intro.imageUrl ? intro.imageWidth : fallback?.width;
  const cropH = intro.imageUrl ? intro.imageHeight : fallback?.height;
  const hasImage = Boolean(intro.imageUrl || fallback?.url);
  // The crop box in fractions of the image (the whole image when nothing is cropped).
  const crop = introCropBox(liveCrop ?? intro.crop, cropW, cropH);
  const r4 = (v) => +v.toFixed(4);

  // Saves the box with the screen shape it was framed at; the whole image needs no saved crop.
  const saveCrop = (c) => {
    setLiveCrop(null);
    const next = introCropBox(c, cropW, cropH);
    update((d) => {
      if (isDefaultIntroCrop(next)) delete d.intro.crop;
      else d.intro.crop = { x: r4(next.x), y: r4(next.y), w: r4(next.w), h: r4(next.h), aspect: r4(Number(aspect)) };
    });
  };
  // Slider helpers: size keeps the box centred, position slides it across the free room.
  const setSize = (key, posKey, v) => {
    const mid = crop[posKey] + crop[key] / 2;
    saveCrop({ ...crop, [key]: v, [posKey]: Math.min(1 - v, Math.max(0, mid - v / 2)) });
  };
  const posOf = (key, posKey) => (crop[key] < 0.999 ? crop[posKey] / (1 - crop[key]) : 0.5);
  const setPos = (key, posKey, v) => saveCrop({ ...crop, [posKey]: v * (1 - crop[key]) });
  const resetCrop = () => saveCrop(null);
  const toggleCropping = () => {
    if (!cropping) {
      setSelectedId(null);
      setPlaying(false);
      setTab('backdrop');
      // Reopen at the screen shape the crop was made for.
      if (intro.crop?.aspect && Math.abs(intro.crop.aspect - aspect) > 0.01) setAspect?.(intro.crop.aspect);
    }
    setCropping(!cropping);
  };
  const current = images.find((i) => i.imageId === intro.imageId);
  // The picture the intro shows, for its image credit.
  const creditId = introImageId(story);
  const creditLabel = images.find((i) => i.imageId === creditId)?.label;

  const editTexts = (fn) => update((d) => fn(d.intro.textElements));
  const addText = () => {
    const t = createIntroText({
      content: story.title || 'Your story title',
      fontFamily: 'Playfair Display Variable',
      fontSize: 104,
      fontWeight: 500,
      positionX: 0.08,
      positionY: texts.length ? Math.min(0.88, 0.74 + (texts.length - 1) * 0.07) : 0.46,
      width: 0.6,
      zIndex: textOps.nextZ(texts),
      animationDelay: 0.2 + texts.length * 0.25,
    });
    if (texts.length) Object.assign(t, { content: 'Add a subtitle', fontFamily: 'Inter Variable', fontSize: 34, fontWeight: 400, lineHeight: 1.5 });
    editTexts((list) => list.push(t));
    setSelectedId(t.id);
    setTab('text');
  };

  // Each background keeps its own text and overlay; switching swaps them in and out.
  const setImage = (img) => {
    if ((img?.imageId || null) === (intro.imageId || null)) return;
    setSelectedId(null);
    setLiveCrop(null);
    const next = switchIntroImage(intro, img, images.map((i) => i.imageId));
    update((d) => { d.intro = next; });
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-x-hidden overflow-y-auto lg:flex-row lg:overflow-hidden">
      {/* LEFT: images */}
      <aside className="panel flex w-full shrink-0 flex-col border-b lg:w-52 lg:border-r lg:border-b-0 xl:w-60">
        <div className="px-4 pt-4 pb-3">
          <h3 className="section-title">Background image</h3>
          <p className="mt-1 text-xs text-ink-400">Each image keeps its own text and overlay. Viewers see the one with the tick.</p>
        </div>
        <div className="flex gap-2 overflow-x-auto px-3 pb-3 lg:flex-1 lg:flex-col lg:overflow-x-visible lg:overflow-y-auto">
          <button
            type="button"
            onClick={() => setImage(null)}
            className={cx('flex w-44 shrink-0 items-center gap-3 rounded-xl border p-2 text-left lg:w-full', !intro.imageId ? 'border-accent-500 bg-accent-500/10' : 'border-ink-700 hover:border-ink-500')}
          >
            <div className="grid h-12 w-16 shrink-0 place-items-center rounded-lg bg-ink-800 text-ink-400"><ImageOff className="size-4" /></div>
            <div className="text-xs">
              <div className="font-medium text-white">Automatic</div>
              <div className="text-ink-400">Cover or first scene</div>
            </div>
          </button>
          {images.map((img) => (
            <button
              key={img.imageId}
              type="button"
              onClick={() => setImage(img)}
              className={cx('relative flex w-44 shrink-0 items-center gap-3 rounded-xl border p-2 text-left lg:w-full', intro.imageId === img.imageId ? 'border-accent-500 bg-accent-500/10' : 'border-ink-700 hover:border-ink-500')}
            >
              <img src={img.thumbUrl || img.url} alt="" className="h-12 w-16 shrink-0 rounded-lg object-cover" />
              <div className="min-w-0 text-xs">
                <div className="font-medium text-white">{img.label}</div>
                <div className="text-ink-400 tabular-nums">{img.width}×{img.height}</div>
              </div>
              {intro.imageId === img.imageId && <Check className="absolute top-2 right-2 size-4 text-accent-300" />}
            </button>
          ))}
        </div>
        {current && (
          <div className="hidden border-t border-ink-700/70 p-4 text-xs text-ink-400 lg:block">
            <div className="section-title mb-2">Image information</div>
            <dl className="grid grid-cols-2 gap-y-1">
              <dt>Size</dt><dd className="text-right text-ink-200 tabular-nums">{current.width}×{current.height}</dd>
              <dt>Aspect</dt><dd className="text-right text-ink-200 tabular-nums">{(current.width / current.height).toFixed(2)}</dd>
              <dt>Source</dt><dd className="text-right text-ink-200">{current.label}</dd>
            </dl>
          </div>
        )}
      </aside>

      {/* CENTER: stage */}
      <section className="flex h-[50vh] min-h-[340px] sm:h-[62vh] min-w-0 shrink-0 flex-col lg:h-auto lg:min-h-0 lg:flex-1 lg:shrink">
        <div className="flex min-h-12 shrink-0 flex-wrap items-center justify-between gap-2 border-b border-ink-700/70 bg-ink-900 px-3 py-2 sm:px-4">
          <div className="flex items-center gap-2">
            <Button size="sm" variant="primary" icon={Plus} onClick={addText}>Add text</Button>
            <Button size="sm" icon={playing ? Square : Play} onClick={() => { setCropping(false); setPlaying((p) => !p); }} disabled={!texts.length}>
              {playing ? 'Stop' : 'Play intro'}
            </Button>
            <Button size="sm" variant={cropping ? 'primary' : undefined} icon={cropping ? Check : Crop} onClick={toggleCropping} disabled={!hasImage} aria-pressed={cropping} title="Choose which part of the image shows">
              {cropping ? 'Done' : 'Crop image'}
            </Button>
          </div>
          <StageControls aspect={aspect} onAspect={setAspect} zoom={zoom} onZoom={setZoom} />
        </div>
        <StageCanvas
          aspect={aspect}
          zoom={zoom}
          texts={playing || cropping ? [] : texts}
          selectedId={selectedId}
          onSelect={(id) => {
            setSelectedId(id);
            if (id) setTab('text');
          }}
          onChange={(id, patch) => editTexts((list) => textOps.patch(list, id, patch))}
          onDelete={(id) => { editTexts((list) => textOps.remove(list, id)); setSelectedId(null); }}
          onDuplicate={(id) => { const nid = uid('txt'); editTexts((list) => textOps.duplicate(list, id, nid)); setSelectedId(nid); }}
          onEditText={() => { setTab('text'); setFocusSignal((n) => n + 1); }}
          renderBackground={({ width, height }) => (
            <>
              <IntroBackdrop intro={intro} fallbackImage={fallback} crop={crop} />
              {/* Same share icons + museum logo the viewer shows; keep text clear of it. */}
              {showFooter && !cropping && <IntroFooter interactive={false} title={story.title} footer={footer} />}
              {playing && <IntroPlayback texts={texts} width={width} height={height} onDone={() => setPlaying(false)} />}
              {cropping && <CropLayer src={cropSrc} crop={crop} iw={cropW} ih={cropH} aspect={width / height} onLive={setLiveCrop} onCommit={saveCrop} />}
            </>
          )}
          // The viewer's (i) credit icon on this picture's corner; click it to write the credit.
          overlay={creditId && !cropping && !playing ? ({ width, height }) => (
            <CanvasCredit
              key={creditId}
              value={editableImageCredit(story, creditId)}
              onChange={(t) => update((d) => setImageCredit(d, creditId, t))}
              imageLabel={creditLabel}
              frame={!isDefaultIntroCrop(crop) && cropW && cropH ? introCropView(crop, cropW, cropH, width, height).frame : undefined}
            />
          ) : null}
        />
        <div className="hidden min-h-9 shrink-0 items-center border-t border-ink-700/70 bg-ink-900 px-4 py-2 text-xs text-ink-400 md:flex">
          {cropping
            ? 'The whole image is shown. Drag the box to move it. Top/bottom handles change the height, left/right handles the width, corners both. The previews on the right show the result.'
            : 'The introduction is the first screen viewers see. Text plays in automatically, then viewers scroll into scene 1.'}
        </div>
      </section>

      {/* RIGHT: properties */}
      <aside className="panel flex w-full shrink-0 flex-col border-t lg:w-[300px] lg:border-t-0 lg:border-l xl:w-[340px]">
        <PanelTabs value={tab} onChange={setTab} tabs={[{ value: 'text', label: 'Text' }, { value: 'layers', label: `Layers (${texts.length})` }, { value: 'backdrop', label: 'Backdrop' }]} />
        <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
          {tab === 'text' && (selected ? (
            <TextInspector
              text={selected}
              timing="seconds"
              focusSignal={focusSignal}
              onChange={(patch) => editTexts((list) => textOps.patch(list, selected.id, patch))}
              onDuplicate={() => { const nid = uid('txt'); editTexts((list) => textOps.duplicate(list, selected.id, nid)); setSelectedId(nid); }}
              onDelete={() => { editTexts((list) => textOps.remove(list, selected.id)); setSelectedId(null); }}
              onLayer={(dir) => editTexts((list) => textOps.layer(list, selected.id, dir))}
            />
          ) : (
            <div className="px-6 py-10 text-center">
              <p className="text-sm text-ink-300">Select a text box on the canvas, or add one.</p>
              <Button className="mt-4" size="sm" variant="primary" icon={Plus} onClick={addText}>Add text</Button>
            </div>
          ))}
          {tab === 'layers' && (
            <LayerList
              texts={texts}
              selectedId={selectedId}
              emptyHint="Add a title or subtitle to the introduction."
              onSelect={(id) => { setSelectedId(id); setTab('text'); }}
              onLayer={(id, dir) => editTexts((list) => textOps.layer(list, id, dir))}
              onDuplicate={(id) => { const nid = uid('txt'); editTexts((list) => textOps.duplicate(list, id, nid)); setSelectedId(nid); }}
              onDelete={(id) => { editTexts((list) => textOps.remove(list, id)); if (id === selectedId) setSelectedId(null); }}
            />
          )}
          {tab === 'backdrop' && (
            <div className="space-y-5 p-5">
              <div className="space-y-4 rounded-xl border border-ink-700/70 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="label mb-0">Image crop</span>
                  <Button size="sm" variant={cropping ? 'primary' : undefined} icon={cropping ? Check : Crop} onClick={toggleCropping} disabled={!hasImage}>
                    {cropping ? 'Done' : 'Adjust on canvas'}
                  </Button>
                </div>
                {hasImage ? (
                  <>
                    <CropPreviews intro={intro} fallback={fallback} crop={crop} />
                    <RangeField label="Width" value={crop.w} min={0.05} max={1} step={0.005} scale={100} suffix="%" hint="Share of the image width inside the box." onChange={(v) => setSize('w', 'x', v)} />
                    <RangeField label="Height" value={crop.h} min={0.05} max={1} step={0.005} scale={100} suffix="%" hint="Share of the image height inside the box." onChange={(v) => setSize('h', 'y', v)} />
                    <RangeField label="Horizontal position" value={posOf('w', 'x')} min={0} max={1} step={0.005} scale={100} suffix="%" hint="0% = against the left edge, 100% = the right edge." onChange={(v) => setPos('w', 'x', v)} />
                    <RangeField label="Vertical position" value={posOf('h', 'y')} min={0} max={1} step={0.005} scale={100} suffix="%" hint="0% = against the top, 100% = the bottom." onChange={(v) => setPos('h', 'y', v)} />
                    <div className="grid grid-cols-2 gap-2">
                      <Button size="sm" icon={Monitor} onClick={() => saveCrop(fitCropBoxToShape(crop, cropW, cropH, aspect))} disabled={!cropW || !cropH} title="Make the box the same shape as the screen above, so it fills that screen exactly">Fit to screen shape</Button>
                      <Button size="sm" icon={RotateCcw} onClick={resetCrop} disabled={isDefaultIntroCrop(crop)}>Reset crop</Button>
                    </div>
                    <p className="hint">Viewers see exactly what is inside the box, centred and never stretched. If the box is a different shape from their screen, a soft blurred copy of the picture fills the sides (or top and bottom). Use Fit to screen shape to make the box fill the screen. Each background image keeps its own crop; the uploaded image is not changed.</p>
                  </>
                ) : (
                  <p className="hint">Add a cover or scene image to crop it.</p>
                )}
              </div>
              <div>
                <span className="label">When the viewer scrolls</span>
                <Segmented
                  className="w-full"
                  value={intro.exitType === 'slideOver' ? 'slideOver' : 'fade'}
                  onChange={(v) => update((d) => { d.intro.exitType = v; })}
                  options={[{ value: 'slideOver', label: 'Scene 1 slides over' }, { value: 'fade', label: 'Intro fades away' }]}
                />
                <p className="hint">Slide over: the first image scrolls up over the title like a page.</p>
              </div>
              <Toggle
                id="intro-show-footer"
                checked={showFooter}
                onChange={(v) => update((d) => { d.intro.showFooter = v; })}
                label="Logo & social icons"
                description="Shown on the cover image by default. Each background image has its own setting."
              />
              <ColorField label="Overlay color" value={intro.overlayColor} onChange={(v) => update((d) => { d.intro.overlayColor = v; })} />
              <RangeField label="Overlay opacity" value={intro.overlayOpacity ?? 0.35} min={0} max={0.95} step={0.01} scale={100} suffix="%" hint="Darkens the image so text stays readable." onChange={(v) => update((d) => { d.intro.overlayOpacity = v; })} />
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

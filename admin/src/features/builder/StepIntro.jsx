import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { Check, ImageOff, Play, Plus, Square } from 'lucide-react';
import { stageUnit } from '@shared/engine/constants.js';
import { createIntroText, introShowsFooter, switchIntroImage, uid } from '@shared/engine/defaults.js';
import { enterOffset } from '@shared/engine/text.js';
import { IntroBackdrop } from '@shared/react/SceneFrame.jsx';
import { IntroFooter } from '@shared/react/IntroFooter.jsx';
import { TextElementView } from '@shared/react/TextElementView.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { ColorField, RangeField, Segmented, Toggle } from '../../components/ui/Fields.jsx';
import StageCanvas from './StageCanvas.jsx';
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

  const fallback = story.coverImage || (story.scenes[0] && { url: story.scenes[0].imageUrl });
  const current = images.find((i) => i.imageId === intro.imageId);

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
            <Button size="sm" icon={playing ? Square : Play} onClick={() => setPlaying((p) => !p)} disabled={!texts.length}>
              {playing ? 'Stop' : 'Play intro'}
            </Button>
          </div>
          <StageControls aspect={aspect} onAspect={setAspect} zoom={zoom} onZoom={setZoom} />
        </div>
        <StageCanvas
          aspect={aspect}
          zoom={zoom}
          texts={playing ? [] : texts}
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
              <IntroBackdrop intro={intro} fallbackImage={fallback} />
              {/* Same share icons + museum logo the viewer shows; keep text clear of it. */}
              {showFooter && <IntroFooter interactive={false} title={story.title} footer={footer} />}
              {playing && <IntroPlayback texts={texts} width={width} height={height} onDone={() => setPlaying(false)} />}
            </>
          )}
        />
        <div className="hidden min-h-9 shrink-0 items-center border-t border-ink-700/70 bg-ink-900 px-4 py-2 text-xs text-ink-400 md:flex">
          The introduction is the first screen viewers see. Text plays in automatically, then viewers scroll into scene 1.
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

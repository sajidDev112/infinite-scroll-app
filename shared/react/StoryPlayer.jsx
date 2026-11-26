import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { stageUnit } from '../engine/constants.js';
import { cameraAt, cameraTransform, hasOpening, sortSteps, transformToCss } from '../engine/camera.js';
import { enterOffset, stateTransform, textStateAt, textWindows } from '../engine/text.js';
import { buildLayout, sceneIndexAt } from '../engine/layout.js';
import { TextElementView } from './TextElementView.jsx';
import { IntroBackdrop, SceneOverlay } from './SceneFrame.jsx';
import { applyBackdrop, applyLens, backdropStyle } from './lens.js';
import { IntroFooter } from './IntroFooter.jsx';
import { introImageCredit, introShowsFooter, sceneImageCredit } from '../engine/defaults.js';
import { ImageCredit } from './ImageCredit.jsx';
import { IntroHeader } from './IntroHeader.jsx';
import { loadStoryFonts } from './customFonts.js';

gsap.registerPlugin(ScrollTrigger);

const LOAD_TIMEOUT = 12000;


function loadImage(url) {
  if (!url) return Promise.resolve();
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => (img.decode ? img.decode().catch(() => {}) : Promise.resolve()).then(resolve);
    img.onerror = () => resolve();
    img.src = url;
  });
}

/**
 * The scroll-driven story experience. Shared, unchanged, by the admin preview and the
 * Electron viewer. Uses the window as the scroller (Lenis smooth scrolling) and one
 * GSAP timeline scrubbed by a ScrollTrigger that pins the stage.
 *
 * props:
 *  story      { title, intro, scenes, coverImage }
 *  onExit     optional → shows "Back" on the completion card
 *  exitLabel  label for that button
 *  shareUrl   link used by the intro's share buttons
 *  footer     intro footer settings (buttons, logo, name) from admin Settings; defaults if omitted
 *  children   overlay UI rendered above the stage (e.g. a back button)
 */
export default function StoryPlayer({ story, onExit, exitLabel = 'Back to stories', shareUrl, footer, children }) {
  const scenes = useMemo(
    () => [...(story?.scenes || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [story],
  );
  const introExit = story?.intro?.exitType === 'slideOver' ? 'slideOver' : 'fade';
  const layout = useMemo(() => buildLayout(scenes, introExit), [scenes, introExit]);
  // Per scene: sorted steps + flattened text list with their scroll windows.
  const prepared = useMemo(
    () =>
      scenes.map((scene) => {
        const steps = sortSteps(scene.animationSteps || []);
        const texts = textWindows(steps).flatMap((win) =>
          (win.step.textElements || []).map((t) => ({ t, win })),
        );
        return { scene, steps, texts };
      }),
    [scenes],
  );

  const rootRef = useRef(null);
  const stageRef = useRef(null);
  const introRef = useRef(null);
  const hintRef = useRef(null);
  const headerRef = useRef(null);
  const endRef = useRef(null);
  const barRef = useRef(null);
  const sceneEls = useRef([]);
  const camEls = useRef([]);
  const lensEls = useRef([]);
  const backdropEls = useRef([]);
  const fullImgEls = useRef([]);
  const textEls = useRef([]); // [sceneIndex][textIndex]
  const introTextEls = useRef([]);
  const lenisRef = useRef(null);

  const [ready, setReady] = useState(false);
  const [loadPct, setLoadPct] = useState(0);
  const [completed, setCompleted] = useState(false);

  const introImage = story?.intro?.imageUrl || story?.coverImage?.url || scenes[0]?.imageUrl;

  // ---- 1. Preload the first screen (intro + first scene + fonts) -----------------
  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setLoadPct(0);
    const jobs = [
      loadImage(introImage),
      loadImage(scenes[0]?.thumbUrl),
      loadImage(scenes[0]?.imageUrl),
      loadStoryFonts(story), // built-in and uploaded fonts the text uses
    ];
    let done = 0;
    jobs.forEach((j) => j.then(() => !cancelled && setLoadPct(Math.round((++done / jobs.length) * 100))));
    const timeout = new Promise((r) => setTimeout(r, LOAD_TIMEOUT));
    Promise.race([Promise.all(jobs), timeout]).then(() => !cancelled && setReady(true));
    return () => {
      cancelled = true;
    };
  }, [introImage, scenes, story]);

  // ---- 2. Build the scroll timeline once everything is in the DOM --------------
  useLayoutEffect(() => {
    if (!ready) return undefined;
    const root = rootRef.current;
    const stage = stageRef.current;
    if (!root || !stage) return undefined;

    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
    document.documentElement.classList.add('sp-playing');
    setCompleted(false);

    const view = { w: stage.clientWidth, h: stage.clientHeight, unit: stageUnit(stage.clientWidth, stage.clientHeight) };
    // Scenes with an opening first appear on their whole image (progress -1).
    const sceneProgress = scenes.map((sc) => (hasOpening(sc) ? -1 : 0));
    const loaded = new Set();
    let active = -1;
    let doneFired = false;
    let trigger = null;

    const renderScene = (i, p) => {
      sceneProgress[i] = p;
      const prep = prepared[i];
      const cam = camEls.current[i];
      if (!prep || !cam) return;
      const { scene } = prep;
      const camera = cameraAt(prep.steps, p, true);
      const tr = cameraTransform(camera, scene.imageWidth, scene.imageHeight, view.w, view.h, scene.fit);
      cam.style.transform = transformToCss(tr);
      applyLens(lensEls.current[i], camera.blur, view.unit);
      applyBackdrop(backdropEls.current[i], scene, camera);
      const els = textEls.current[i] || [];
      prep.texts.forEach(({ t, win }, k) => {
        const el = els[k];
        if (!el) return;
        const s = textStateAt(t, win, p);
        el.style.opacity = s.opacity.toFixed(4);
        el.style.visibility = s.opacity < 0.002 ? 'hidden' : 'visible';
        el.style.transform = stateTransform(s, view.unit);
      });
    };

    const measure = () => {
      view.w = stage.clientWidth;
      view.h = stage.clientHeight;
      view.unit = stageUnit(view.w, view.h);
      stage.style.setProperty('--u', `${view.unit}px`);
      scenes.forEach((_, i) => renderScene(i, sceneProgress[i]));
    };
    measure();

    // Lazy-load full-resolution images around the active scene, release far ones.
    const syncImages = (idx) => {
      scenes.forEach((scene, j) => {
        const el = fullImgEls.current[j];
        if (!el) return;
        const near = j >= idx - 1 && j <= idx + 2;
        const far = j < idx - 2 || j > idx + 3;
        if (near && !loaded.has(j)) {
          loaded.add(j);
          loadImage(scene.imageUrl).then(() => {
            if (!loaded.has(j)) return;
            el.src = scene.imageUrl;
            el.classList.add('is-loaded');
          });
        } else if (far && loaded.has(j)) {
          loaded.delete(j);
          el.classList.remove('is-loaded');
          el.removeAttribute('src');
        }
      });
    };
    syncImages(0);

    // Smooth scrolling, synchronised with ScrollTrigger through the GSAP ticker. A low lerp
    // gives a long, soft glide after each wheel move; the multipliers keep one wheel notch or
    // swipe from covering too much of the story, so zooms unfold slowly.
    const lenis = new Lenis({ lerp: 0.06, smoothWheel: true, wheelMultiplier: 0.7, touchMultiplier: 1.1 });
    lenisRef.current = lenis;
    lenis.on('scroll', ScrollTrigger.update);
    const tick = (time) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    const ro = new ResizeObserver(() => measure());
    ro.observe(stage);

    const ctx = gsap.context(() => {
      const sceneNodes = sceneEls.current.slice(0, scenes.length);
      gsap.set(sceneNodes, { autoAlpha: 0, yPercent: 0, scale: 1, zIndex: 1 });
      // Slide-over intro: scene 1 waits below the screen and scrolls up over the title.
      if (sceneNodes[0]) gsap.set(sceneNodes[0], introExit === 'slideOver' ? { autoAlpha: 1, yPercent: 100 } : { autoAlpha: 1 });
      gsap.set(introRef.current, { zIndex: introExit === 'slideOver' ? 0 : 5 });
      gsap.set(endRef.current, { autoAlpha: 0 });

      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: root,
          pin: stage,
          start: 'top top',
          end: () => `+=${layout.total * window.innerHeight}`,
          // The camera catches up with the scroll over ~0.6 s, smoothing out uneven
          // wheels and trackpads instead of following every tick exactly.
          scrub: 0.6,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            if (barRef.current) barRef.current.style.transform = `scaleX(${self.progress})`;
            const idx = sceneIndexAt(layout, self.progress * layout.total);
            if (idx !== active) {
              active = idx;
              syncImages(idx);
            }
            const isDone = self.progress > 0.985;
            if (isDone !== doneFired) {
              doneFired = isDone;
              setCompleted(isDone);
            }
          },
        },
      });

      const nofrom = { immediateRender: false };
      layout.segments.forEach((seg) => {
        if (seg.type === 'intro' && seg.kind === 'slideOver') {
          tl.fromTo(sceneNodes[0], { yPercent: 100 }, { yPercent: 0, duration: seg.length, ...nofrom }, seg.start);
          tl.set(introRef.current, { autoAlpha: 0 }, seg.start + seg.length);
          tl.fromTo(hintRef.current, { autoAlpha: 1 }, { autoAlpha: 0, duration: seg.length * 0.3, ...nofrom }, seg.start);
          // The Impart header belongs to the cover only: gone as soon as scrolling starts.
          tl.fromTo(headerRef.current, { autoAlpha: 1 }, { autoAlpha: 0, duration: seg.length * 0.06, ...nofrom }, seg.start);
        } else if (seg.type === 'intro') {
          tl.fromTo(introRef.current, { autoAlpha: 1, scale: 1 }, { autoAlpha: 0, scale: 1.04, duration: seg.length, ease: 'power1.in', ...nofrom }, seg.start);
          tl.fromTo(hintRef.current, { autoAlpha: 1 }, { autoAlpha: 0, duration: seg.length * 0.4, ...nofrom }, seg.start);
          tl.fromTo(headerRef.current, { autoAlpha: 1 }, { autoAlpha: 0, duration: seg.length * 0.06, ...nofrom }, seg.start);
        } else if (seg.type === 'scene') {
          if (seg.opening) {
            const open = { p: -1 };
            tl.to(open, { p: 0, duration: seg.opening, onUpdate: () => renderScene(seg.index, open.p) }, seg.start);
          }
          const proxy = { p: 0 };
          tl.to(proxy, { p: 1, duration: seg.length - seg.opening, onUpdate: () => renderScene(seg.index, proxy.p) }, seg.start + seg.opening);
        } else if (seg.type === 'transition') {
          const prev = sceneNodes[seg.from];
          const next = sceneNodes[seg.to];
          const { start, length: L } = seg;
          if (seg.kind === 'slideOver') {
            // Next image scrolls up over the current one, 1:1 with the scroll, like a page.
            tl.fromTo(next, { autoAlpha: 1, yPercent: 100 }, { yPercent: 0, duration: L, ...nofrom }, start);
            tl.set(prev, { autoAlpha: 0 }, start + L);
          } else if (seg.kind === 'fadeBlack') {
            tl.fromTo(prev, { autoAlpha: 1 }, { autoAlpha: 0, duration: L / 2, ...nofrom }, start);
            tl.fromTo(next, { autoAlpha: 0 }, { autoAlpha: 1, duration: L / 2, ...nofrom }, start + L / 2);
          } else if (seg.kind === 'slideUp') {
            tl.fromTo(next, { autoAlpha: 1, yPercent: 100 }, { yPercent: 0, duration: L, ease: 'power2.inOut', ...nofrom }, start);
            tl.fromTo(prev, { yPercent: 0 }, { yPercent: -22, duration: L, ease: 'power2.inOut', ...nofrom }, start);
            tl.set(prev, { autoAlpha: 0 }, start + L);
          } else if (seg.kind === 'zoomThrough') {
            tl.fromTo(prev, { autoAlpha: 1, scale: 1 }, { autoAlpha: 0, scale: 1.25, duration: L, ease: 'power2.in', ...nofrom }, start);
            tl.fromTo(next, { autoAlpha: 0, scale: 0.92 }, { autoAlpha: 1, scale: 1, duration: L, ease: 'power2.out', ...nofrom }, start);
          } else {
            tl.fromTo(next, { autoAlpha: 0 }, { autoAlpha: 1, duration: L, ease: 'power1.inOut', ...nofrom }, start);
            tl.set(prev, { autoAlpha: 0 }, start + L);
          }
        } else if (seg.type === 'end') {
          tl.fromTo(endRef.current, { autoAlpha: 0 }, { autoAlpha: 1, duration: seg.length, ...nofrom }, seg.start);
        }
      });

      // Intro text plays on open (time based), like a title sequence.
      (story?.intro?.textElements || []).forEach((t, k) => {
        const el = introTextEls.current[k];
        if (!el) return;
        const from = enterOffset(t.animationType, 0);
        gsap.fromTo(
          el,
          { opacity: 0, x: from.x * view.unit, y: from.y * view.unit, scale: from.scale },
          {
            opacity: t.opacity ?? 1,
            x: 0,
            y: 0,
            scale: 1,
            duration: Math.max(0.05, Number(t.animationDuration) || 1),
            delay: Math.max(0, Number(t.animationDelay) || 0),
            ease: t.easing || 'power3.out',
          },
        );
      });
      gsap.fromTo(hintRef.current?.firstChild, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 1, delay: 1.2 });
    }, root);

    trigger = ScrollTrigger.getAll().find((t) => t.trigger === root) || null;
    ScrollTrigger.refresh();

    // Window size changes (full screen, rotating a phone, resizing): the pinned stage
    // keeps its old pixel size until ScrollTrigger re-measures, which leaves a gap.
    // Re-measure and keep the viewer at the same point in the story.
    let resizeTimer = 0;
    let lastW = window.innerWidth;
    let lastH = window.innerHeight;
    const onWindowResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (window.innerWidth === lastW && window.innerHeight === lastH) return;
        lastW = window.innerWidth;
        lastH = window.innerHeight;
        const st = trigger || ScrollTrigger.getAll().find((t) => t.trigger === root);
        const progress = st ? st.progress : 0;
        ScrollTrigger.refresh();
        if (st && progress > 0) {
          const y = st.start + progress * (st.end - st.start);
          if (lenisRef.current) lenisRef.current.scrollTo(y, { immediate: true, force: true });
          else window.scrollTo(0, y);
          ScrollTrigger.update();
        }
        measure();
      }, 120);
    };
    window.addEventListener('resize', onWindowResize);
    document.addEventListener('fullscreenchange', onWindowResize);
    // Some browsers/devices change the viewport without a resize event; watch it directly too.
    // A hidden fixed, full-window box resizes exactly with the viewport.
    const probe = document.createElement('div');
    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText = 'position:fixed;inset:0;visibility:hidden;pointer-events:none;z-index:-1';
    document.body.appendChild(probe);
    const viewportRo = new ResizeObserver(onWindowResize);
    viewportRo.observe(probe);

    return () => {
      document.documentElement.classList.remove('sp-playing');
      ro.disconnect();
      clearTimeout(resizeTimer);
      viewportRo.disconnect();
      probe.remove();
      window.removeEventListener('resize', onWindowResize);
      document.removeEventListener('fullscreenchange', onWindowResize);
      ctx.revert();
      gsap.ticker.remove(tick);
      gsap.ticker.lagSmoothing(500, 33);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, [ready, layout, prepared, scenes, story]);

  const replay = () => {
    if (lenisRef.current) lenisRef.current.scrollTo(0, { duration: 2.2 });
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div ref={rootRef} className="sp-root">
      <div ref={stageRef} className="sp-stage">
        {prepared.map(({ scene, texts }, i) => (
          <div key={scene.sceneId || i} ref={(el) => (sceneEls.current[i] = el)} className="sp-scene">
            <div ref={(el) => (backdropEls.current[i] = el)} className="sp-backdrop" style={backdropStyle(scene)} aria-hidden="true" />
            <div ref={(el) => (lensEls.current[i] = el)} className="sp-lens">
              <div
                ref={(el) => (camEls.current[i] = el)}
                className="sp-cam"
                style={{ width: scene.imageWidth, height: scene.imageHeight }}
              >
                <img className="sp-img sp-thumb" src={scene.thumbUrl || scene.imageUrl} alt="" draggable={false} />
                <img ref={(el) => (fullImgEls.current[i] = el)} className="sp-img sp-full" alt="" draggable={false} />
              </div>
            </div>
            <SceneOverlay scene={scene} />
            <div className="sp-texts">
              {texts.map(({ t }, k) => (
                <TextElementView
                  liveLinks
                  key={`${t.id}-${k}`}
                  ref={(el) => {
                    textEls.current[i] = textEls.current[i] || [];
                    textEls.current[i][k] = el;
                  }}
                  text={t}
                  state={{ opacity: 0, x: 0, y: 0, scale: 1 }}
                  style={{ visibility: 'hidden' }}
                />
              ))}
            </div>
            <ImageCredit text={sceneImageCredit(story, scene)} />
          </div>
        ))}

        <div ref={introRef} className="sp-intro">
          <IntroBackdrop intro={story?.intro} fallbackImage={{ url: introImage }}>
            <ImageCredit text={introImageCredit(story)} />
          </IntroBackdrop>
          <div className="sp-texts">
            {(story?.intro?.textElements || []).map((t, k) => (
              <TextElementView
                key={t.id}
                ref={(el) => (introTextEls.current[k] = el)}
                text={t}
                liveLinks
                style={{ opacity: 0, transform: 'none' }}
              />
            ))}
          </div>
          <IntroHeader ref={headerRef} logoUrl={footer?.logo?.url} />
          {introShowsFooter(story) && <IntroFooter storyId={story?.id} title={story?.title} description={story?.description} author={story?.author} shareUrl={shareUrl} footer={footer} />}
          {!scenes.length && <div className="sp-empty">This story has no scenes yet.</div>}
        </div>

        <div ref={hintRef} className="sp-hint" aria-hidden="true">
          <div>
            <span>Scroll to begin</span>
            <i className="sp-hint-line" />
          </div>
        </div>

        <div ref={endRef} className="sp-end">
          <div className="sp-end-inner">
            <p className="sp-end-kicker">The end</p>
            <h2 className="sp-end-title">{story?.title}</h2>
            <div className="sp-end-actions">
              <button type="button" className="sp-btn" onClick={replay} tabIndex={completed ? 0 : -1}>
                Replay story
              </button>
              {onExit && (
                <button type="button" className="sp-btn sp-btn-primary" onClick={onExit} tabIndex={completed ? 0 : -1}>
                  {exitLabel}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="sp-progress"><i ref={barRef} /></div>
        {children}

        {!ready && (
          <div className="sp-loading">
            <div className="sp-spinner" />
            <span>{loadPct}%</span>
          </div>
        )}
      </div>
    </div>
  );
}

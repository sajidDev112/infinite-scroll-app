import { useMemo, useRef, useState } from 'react';
import { Pause, Play, Plus } from 'lucide-react';
import { ZOOM_MAX } from '@shared/engine/constants.js';
import { cameraAt } from '@shared/engine/camera.js';
import { clamp01 } from '@shared/engine/easing.js';
import { Button } from '../../components/ui/Button.jsx';
import { cx } from '../../lib/utils.js';

/**
 * Scene timeline: x = scroll progress through the scene. Shows the zoom curve,
 * one marker per step (drag to change its scroll position) and a scrub playhead.
 */
export default function StepTimeline({ steps, selectedId, onSelect, onMoveStep, onAddStep, preview, onScrub, playing, onTogglePlay }) {
  const trackRef = useRef(null);
  const [dragging, setDragging] = useState(null); // { id, p }

  const shown = steps.map((s) => (dragging?.id === s.stepId ? { ...s, progress: dragging.p } : s));
  const curve = useMemo(() => {
    const pts = [];
    for (let i = 0; i <= 120; i += 1) {
      const p = i / 120;
      const z = cameraAt(shown, p).zoom;
      pts.push(`${(p * 100).toFixed(2)},${(100 - ((z - 1) / (ZOOM_MAX - 1)) * 82 - 9).toFixed(2)}`);
    }
    return pts.join(' ');
  }, [shown]);

  const pFromEvent = (e) => {
    const r = trackRef.current.getBoundingClientRect();
    return Math.round(clamp01((e.clientX - r.left) / r.width) * 100) / 100;
  };

  const startScrub = (e) => {
    if (e.button !== 0) return;
    onScrub(pFromEvent(e));
    const move = (ev) => onScrub(pFromEvent(ev));
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const startMarker = (e, s) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    onSelect(s.stepId);
    let p = s.progress;
    let moved = false;
    const move = (ev) => {
      moved = true;
      p = pFromEvent(ev);
      setDragging({ id: s.stepId, p });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setDragging(null);
      if (moved) onMoveStep(s.stepId, p);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const sorted = [...shown].sort((a, b) => a.progress - b.progress);

  return (
    <div className="shrink-0 border-t border-ink-700/70 bg-ink-900 px-3 pt-3 pb-4 sm:px-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 sm:gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Button size="icon-sm" variant={playing ? 'primary' : 'secondary'} onClick={onTogglePlay} aria-label={playing ? 'Pause scene preview' : 'Play scene preview'} title="Play this scene">
            {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          </Button>
          <span className="hidden text-xs text-ink-400 sm:inline">
            {preview == null ? 'Drag the playhead to preview the scroll' : preview < 0 ? <>Opening — whole image, zooming into step 1</> : <>Previewing at <span className="text-ink-100 tabular-nums">{Math.round(preview * 100)}%</span> of the scene</>}
          </span>
        </div>
        <div className="flex max-w-full min-w-0 items-center gap-1.5 overflow-x-auto">
          {sorted.map((s, i) => (
            <button
              key={s.stepId}
              type="button"
              onClick={() => onSelect(s.stepId)}
              className={cx('h-7 shrink-0 rounded-md px-2.5 text-xs font-medium tabular-nums', s.stepId === selectedId ? 'bg-accent-500 text-white' : 'bg-ink-750 text-ink-200 hover:bg-ink-700')}
            >
              {i + 1} · {Math.round(s.progress * 100)}%
            </button>
          ))}
          <Button size="sm" icon={Plus} onClick={onAddStep} disabled={steps.length >= 30}>Step</Button>
        </div>
      </div>

      <div ref={trackRef} className="relative h-[72px] cursor-pointer touch-none rounded-lg border border-ink-700 bg-ink-950" onPointerDown={startScrub}>
        {[0.25, 0.5, 0.75].map((g) => <div key={g} className="absolute inset-y-0 w-px bg-ink-800" style={{ left: `${g * 100}%` }} />)}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden="true">
          <polyline points={curve} fill="none" stroke="rgba(129,140,248,0.75)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        </svg>
        <span className="pointer-events-none absolute top-1 right-2 text-[10px] text-ink-500">zoom</span>
        {sorted.map((s, i) => (
          <button
            key={s.stepId}
            type="button"
            onPointerDown={(e) => startMarker(e, s)}
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize"
            style={{ left: `${s.progress * 100}%` }}
            aria-label={`Step ${i + 1} at ${Math.round(s.progress * 100)}%, zoom ${s.zoomLevel}x`}
            title={`Step ${i + 1} · ${Math.round(s.progress * 100)}% · ${s.zoomLevel}x — drag to move`}
          >
            <span className={cx('grid size-6 rotate-45 place-items-center rounded-[5px] border-2 shadow', s.stepId === selectedId ? 'border-white bg-accent-500' : 'border-ink-300 bg-ink-700')}>
              <span className="-rotate-45 text-[10px] font-bold text-white">{i + 1}</span>
            </span>
          </button>
        ))}
        {preview != null && (
          <div className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-amber-300" style={{ left: `${Math.max(0, preview) * 100}%` }}>
            <span className="absolute -top-1 left-1/2 size-2.5 -translate-x-1/2 rotate-45 bg-amber-300" />
          </div>
        )}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-ink-500 tabular-nums"><span>0%</span><span>Scene scroll</span><span>100%</span></div>
    </div>
  );
}

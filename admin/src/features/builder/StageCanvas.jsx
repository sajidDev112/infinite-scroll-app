import { useRef, useState } from 'react';
import { stageUnit } from '@shared/engine/constants.js';
import { clamp } from '@shared/engine/easing.js';
import { TextElementView } from '@shared/react/TextElementView.jsx';
import { useElementSize } from '../../hooks/useElementSize.js';
import { cx } from '../../lib/utils.js';

const r4 = (v) => Math.round(v * 10000) / 10000;
const SNAP = 0.012;

/**
 * A stage of the chosen aspect ratio that renders text exactly like the viewer
 * (same component, same --u scaling) and lets the admin drag/resize text boxes.
 */
export default function StageCanvas({
  aspect,
  zoom = 1,
  renderBackground,
  texts = [],
  selectedId,
  onSelect,
  onChange,
  onDelete,
  onDuplicate,
  onEditText,
  overlay,
}) {
  const [wrapRef, box] = useElementSize();
  const stageRef = useRef(null);
  const [live, setLive] = useState(null);
  const [guides, setGuides] = useState({ v: false, h: false });

  const pad = 40;
  const fitW = Math.max(0, Math.min(box.width - pad * 2, (box.height - pad * 2) * aspect));
  const width = Math.round(fitW * zoom);
  const height = Math.round(width / aspect);
  const unit = stageUnit(width, height);

  const startDrag = (e, t, mode) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    onSelect(t.id);
    stageRef.current?.focus({ preventScroll: true });
    const stageRect = stageRef.current.getBoundingClientRect();
    const el = e.currentTarget.closest('[data-text-id]');
    const rect = el.getBoundingClientRect();
    const bw = rect.width / stageRect.width;
    const bh = rect.height / stageRect.height;
    const start = { x: e.clientX, y: e.clientY, px: t.positionX ?? 0, py: t.positionY ?? 0, w: t.width > 0 ? t.width : bw };
    let latest = null;

    const move = (ev) => {
      const dx = (ev.clientX - start.x) / stageRect.width;
      const dy = (ev.clientY - start.y) / stageRect.height;
      if (mode === 'move') {
        let x = start.px + dx;
        let y = start.py + dy;
        const g = { v: false, h: false };
        if (!ev.altKey) {
          if (Math.abs(x + bw / 2 - 0.5) < SNAP) { x = 0.5 - bw / 2; g.v = true; }
          if (Math.abs(y + bh / 2 - 0.5) < SNAP) { y = 0.5 - bh / 2; g.h = true; }
        }
        latest = { positionX: r4(clamp(x, -0.5, 1.2)), positionY: r4(clamp(y, -0.5, 1.2)) };
        setGuides(g);
      } else {
        latest = { width: r4(clamp(start.w + dx, 0.03, 1)) };
      }
      setLive({ id: t.id, patch: latest });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setGuides({ v: false, h: false });
      setLive(null);
      if (latest) onChange(t.id, latest);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const onKeyDown = (e) => {
    const t = texts.find((x) => x.id === selectedId);
    if (!t || e.target !== stageRef.current) return;
    const step = e.shiftKey ? 0.02 : 0.004;
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[e.key]) {
      e.preventDefault();
      const [dx, dy] = moves[e.key];
      onChange(t.id, { positionX: r4((t.positionX ?? 0) + dx), positionY: r4((t.positionY ?? 0) + dy) });
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      onDelete?.(t.id);
    } else if (e.key === 'Escape') {
      onSelect(null);
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
      e.preventDefault();
      onDuplicate?.(t.id);
    }
  };

  return (
    <div ref={wrapRef} className="relative min-h-0 flex-1 overflow-auto bg-ink-950" onPointerDown={() => onSelect(null)}>
      <div className="grid min-h-full place-items-center" style={{ minWidth: width + pad * 2, padding: pad }}>
        {width > 0 && (
          <div
            ref={stageRef}
            tabIndex={0}
            onKeyDown={onKeyDown}
            className="relative shadow-pop ring-1 ring-white/10 outline-none focus-visible:ring-2 focus-visible:ring-accent-400"
            style={{ width, height, '--u': `${unit}px` }}
            aria-label="Editing stage. Select a text box, then use arrow keys to move it."
          >
            <div className="absolute inset-0 overflow-hidden bg-black">{renderBackground?.({ width, height })}</div>
            <div className="absolute inset-0 overflow-hidden">
              {texts.map((t) => {
                const merged = live?.id === t.id ? { ...t, ...live.patch } : t;
                const selected = t.id === selectedId;
                return (
                  <TextElementView
                    key={t.id}
                    data-text-id={t.id}
                    text={{ ...merged, content: merged.content || ' ' }}
                    unitPx={unit}
                    className={cx('cursor-move select-none', selected ? 'outline-2 outline-offset-2 outline-accent-400 outline-solid' : 'hover:outline-1 hover:outline-offset-2 hover:outline-white/40 hover:outline-dashed')}
                    style={{ transform: 'none', opacity: Math.max(0.15, merged.opacity ?? 1) }}
                    onPointerDown={(e) => startDrag(e, t, 'move')}
                    onDoubleClick={() => onEditText?.(t.id)}
                  >
                    {selected && (
                      <span
                        role="presentation"
                        title="Drag to resize width"
                        onPointerDown={(e) => startDrag(e, t, 'resize')}
                        className="absolute top-1/2 -right-[9px] h-7 w-2.5 -translate-y-1/2 cursor-ew-resize rounded-full border-2 border-ink-950 bg-accent-400"
                      />
                    )}
                  </TextElementView>
                );
              })}
            </div>
            {guides.v && <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px bg-fuchsia-400" />}
            {guides.h && <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-fuchsia-400" />}
            {overlay}
          </div>
        )}
      </div>
    </div>
  );
}

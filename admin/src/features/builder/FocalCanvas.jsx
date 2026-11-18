import { useEffect, useState } from 'react';
import { Circle, Group, Image as KImage, Label, Layer, Line, Rect, Stage, Tag, Text } from 'react-konva';
import { cameraTransform, projectPoint, visibleRegion } from '@shared/engine/camera.js';
import { clamp01 } from '@shared/engine/easing.js';
import { useElementSize } from '../../hooks/useElementSize.js';

function useHtmlImage(src) {
  const [img, setImg] = useState(null);
  useEffect(() => {
    if (!src) return undefined;
    let alive = true;
    const el = new window.Image();
    el.onload = () => alive && setImg(el);
    el.src = src;
    return () => { alive = false; };
  }, [src]);
  return img;
}

const ACCENT = '#818cf8';
const r4 = (v) => Math.round(v * 10000) / 10000;

/**
 * Focal point editor: the whole image (contain-fit), the focal marker (click or drag),
 * and the exact region the viewer will show for this step's zoom on the chosen screen shape.
 */
export default function FocalCanvas({ scene, steps, step, aspect, onChange, onSelectStep, onDragFocal }) {
  const [wrapRef, size] = useElementSize();
  const full = useHtmlImage(scene.imageUrl);
  const thumb = useHtmlImage(scene.thumbUrl);
  const image = full || thumb;
  const [drag, setDrag] = useState(null);

  const iw = scene.imageWidth;
  const ih = scene.imageHeight;
  const pad = 36;
  const k = Math.max(0.0001, Math.min((size.width - pad * 2) / iw, (size.height - pad * 2) / ih));
  const dw = iw * k;
  const dh = ih * k;
  const ox = (size.width - dw) / 2;
  const oy = (size.height - dh) / 2;

  const fp = step.focalPoint;
  const focal = drag || { x: fp.x, y: fp.y };

  // Viewer frame for this step on a reference screen of the chosen aspect.
  const VW = 1920;
  const VH = VW / aspect;
  const tr = cameraTransform({ zoom: step.zoomLevel, fx: focal.x, fy: focal.y, tx: fp.targetPositionX, ty: fp.targetPositionY }, iw, ih, VW, VH, scene.fit);
  const region = visibleRegion(tr, iw, ih, VW, VH);
  const rx = ox + region.x * dw;
  const ry = oy + region.y * dh;
  const rw = region.width * dw;
  const rh = region.height * dh;
  const landed = projectPoint(tr, iw, ih, VW, VH, focal.x, focal.y);
  const offTarget = Math.hypot(landed.x - fp.targetPositionX, landed.y - fp.targetPositionY) > 0.01;

  const toNorm = (px, py) => ({ x: r4(clamp01((px - ox) / dw)), y: r4(clamp01((py - oy) / dh)) });

  const setFromPointer = (e) => {
    const pos = e.target.getStage().getPointerPosition();
    if (!pos) return;
    if (pos.x < ox || pos.x > ox + dw || pos.y < oy || pos.y > oy + dh) return;
    onChange(toNorm(pos.x, pos.y));
  };

  const mx = ox + focal.x * dw;
  const my = oy + focal.y * dh;
  const ready = size.width > 0 && size.height > 0;

  return (
    <div ref={wrapRef} className="relative min-h-0 flex-1 bg-ink-950">
      {ready && (
        <Stage width={size.width} height={size.height}>
          <Layer>
            <Rect x={ox} y={oy} width={dw} height={dh} fill="#0d0f14" />
            {image && <KImage image={image} x={ox} y={oy} width={dw} height={dh} onClick={setFromPointer} onTap={setFromPointer} onMouseEnter={(e) => (e.target.getStage().container().style.cursor = 'crosshair')} onMouseLeave={(e) => (e.target.getStage().container().style.cursor = 'default')} />}
            {/* Dim everything outside the viewer frame */}
            <Group listening={false}>
              <Rect x={ox} y={oy} width={dw} height={Math.max(0, ry - oy)} fill="rgba(5,6,10,0.62)" />
              <Rect x={ox} y={ry + rh} width={dw} height={Math.max(0, oy + dh - ry - rh)} fill="rgba(5,6,10,0.62)" />
              <Rect x={ox} y={ry} width={Math.max(0, rx - ox)} height={rh} fill="rgba(5,6,10,0.62)" />
              <Rect x={rx + rw} y={ry} width={Math.max(0, ox + dw - rx - rw)} height={rh} fill="rgba(5,6,10,0.62)" />
              <Rect x={rx} y={ry} width={rw} height={rh} stroke="#ffffff" strokeWidth={1.5} dash={[7, 5]} />
              {/* rule-of-thirds inside the frame */}
              {[1, 2].map((i) => (
                <Group key={i}>
                  <Line points={[rx + (rw * i) / 3, ry, rx + (rw * i) / 3, ry + rh]} stroke="rgba(255,255,255,0.14)" strokeWidth={1} />
                  <Line points={[rx, ry + (rh * i) / 3, rx + rw, ry + (rh * i) / 3]} stroke="rgba(255,255,255,0.14)" strokeWidth={1} />
                </Group>
              ))}
              <Label x={rx} y={Math.max(4, ry - 26)}>
                <Tag fill="rgba(0,0,0,0.75)" cornerRadius={4} />
                <Text text={`Viewer frame · ${step.zoomLevel.toFixed(2)}x`} fill="#fff" fontSize={12} padding={6} fontFamily="Inter Variable, system-ui" />
              </Label>
            </Group>

            {/* Other steps' focal points */}
            {steps.map((s, i) => (s.stepId === step.stepId ? null : (
              <Group
                key={s.stepId}
                x={ox + s.focalPoint.x * dw}
                y={oy + s.focalPoint.y * dh}
                opacity={0.75}
                onClick={() => onSelectStep(s.stepId)}
                onTap={() => onSelectStep(s.stepId)}
                onMouseEnter={(e) => (e.target.getStage().container().style.cursor = 'pointer')}
                onMouseLeave={(e) => (e.target.getStage().container().style.cursor = 'default')}
              >
                <Circle radius={10} fill="rgba(0,0,0,0.65)" stroke="rgba(255,255,255,0.7)" strokeWidth={1} />
                <Text text={String(i + 1)} fill="#fff" fontSize={10} width={20} height={20} offsetX={10} offsetY={6} align="center" fontStyle="bold" />
              </Group>
            )))}

            {/* Active focal marker */}
            <Group
              x={mx}
              y={my}
              draggable
              dragBoundFunc={(pos) => ({ x: Math.min(ox + dw, Math.max(ox, pos.x)), y: Math.min(oy + dh, Math.max(oy, pos.y)) })}
              onDragMove={(e) => {
                const n = toNorm(e.target.x(), e.target.y());
                setDrag(n);
                onDragFocal?.(n);
              }}
              onDragEnd={(e) => {
                const n = toNorm(e.target.x(), e.target.y());
                setDrag(null);
                onDragFocal?.(null);
                onChange(n);
              }}
              onMouseEnter={(e) => (e.target.getStage().container().style.cursor = 'grab')}
              onMouseLeave={(e) => (e.target.getStage().container().style.cursor = 'default')}
            >
              <Circle radius={22} fill="rgba(129,140,248,0.18)" stroke={ACCENT} strokeWidth={2} shadowColor="#000" shadowBlur={8} shadowOpacity={0.6} />
              <Line points={[-32, 0, -10, 0]} stroke="#fff" strokeWidth={1.5} />
              <Line points={[10, 0, 32, 0]} stroke="#fff" strokeWidth={1.5} />
              <Line points={[0, -32, 0, -10]} stroke="#fff" strokeWidth={1.5} />
              <Line points={[0, 10, 0, 32]} stroke="#fff" strokeWidth={1.5} />
              <Circle radius={4} fill="#fff" />
            </Group>
          </Layer>
        </Stage>
      )}
      <div className="pointer-events-none absolute top-3 left-3 flex flex-col gap-1.5">
        <span className="rounded-md bg-black/65 px-2.5 py-1 text-xs text-white tabular-nums backdrop-blur">
          Focal {Math.round(focal.x * 100)}%, {Math.round(focal.y * 100)}% · click or drag to move
        </span>
        {offTarget && (
          <span className="rounded-md bg-amber-500/90 px-2.5 py-1 text-xs font-medium text-black">
            Near the image edge — the frame stops at the edge, so the focal point sits off its screen position.
          </span>
        )}
      </div>
    </div>
  );
}

import { ArrowDown, ArrowUp, Copy, Crosshair, Plus, Trash2, Type } from 'lucide-react';
import { REFERENCE_SCROLL_LENGTH, SCROLL_LENGTH_MAX, SCROLL_LENGTH_MIN, TRANSITION_TYPES, ZOOM_PRESETS, ZOOM_SPEED_PRESETS } from '@shared/engine/constants.js';
import { EASINGS } from '@shared/engine/easing.js';
import { Button } from '../../components/ui/Button.jsx';
import { ColorField, Field, Input, NumberInput, RangeField, Segmented, Select, Textarea } from '../../components/ui/Fields.jsx';
import { IMAGE_CREDIT_MAX } from '@shared/engine/defaults.js';
import { cx } from '../../lib/utils.js';
import { ItalicTextarea } from './ItalicWords.jsx';

const THIRDS = [1 / 3, 0.5, 2 / 3];

function Block({ title, children, right }) {
  return (
    <section className="space-y-4 border-b border-ink-700/70 px-5 py-5">
      <div className="flex items-center justify-between">
        <h4 className="section-title">{title}</h4>
        {right}
      </div>
      {children}
    </section>
  );
}

// ---- Zoom speed ---------------------------------------------------------------------
// Stored as the scene's scrollLength (screen-heights of scrolling, 1–12: more = slower).
// The slider shows it the intuitive way round, Slow ← → Fast, on a log scale so each
// step of the slider changes the speed by the same proportion.
const SPEED_RATIO = Math.log(SCROLL_LENGTH_MAX / SCROLL_LENGTH_MIN);
const lengthToSpeed = (len) => Math.round((Math.log(SCROLL_LENGTH_MAX / len) / SPEED_RATIO) * 100);
const speedToLength = (v) => Math.round(SCROLL_LENGTH_MAX * Math.exp(-SPEED_RATIO * (v / 100)) * 20) / 20;
const speedName = (len) => (len >= 7 ? 'Very slow' : len >= 4 ? 'Slow' : len >= 2.5 ? 'Normal' : len >= 1.6 ? 'Fast' : 'Very fast');

export function ZoomSpeedControl({ scene, onChange, onApplyToAll, compact = false }) {
  const len = Number(scene.scrollLength) || REFERENCE_SCROLL_LENGTH;
  const speed = lengthToSpeed(len);
  return (
    <div className="space-y-3">
      <div>
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          <span className="text-[13px] font-medium text-ink-200">Zoom speed</span>
          <span className="text-[13px] font-semibold text-accent-300 tabular-nums">{speedName(len)} · {speed}%</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-ink-400">Slow</span>
          <input
            type="range"
            className="h-1.5 min-w-0 flex-1 cursor-pointer"
            min={0}
            max={100}
            step={1}
            value={speed}
            onChange={(e) => onChange({ scrollLength: speedToLength(Number(e.target.value)) })}
            aria-label="Zoom speed"
            aria-valuetext={`${speedName(len)}, ${speed}%`}
          />
          <span className="text-[11px] text-ink-400">Fast</span>
        </div>
        <p className="hint">
          Drag left for a slower, smoother zoom. This scene's zooms are spread over {Number(len.toFixed(2))} screen{len === 1 ? '' : 's'} of scrolling.
        </p>
      </div>
      {!compact && (
        <Segmented
          className="w-full"
          value={ZOOM_SPEED_PRESETS.find((p) => p.value === len)?.value}
          onChange={(v) => onChange({ scrollLength: v })}
          options={ZOOM_SPEED_PRESETS}
        />
      )}
      {onApplyToAll && (
        <Button size="sm" variant="secondary" className="w-full" onClick={() => onApplyToAll(len)}>
          Use this speed for all scenes
        </Button>
      )}
    </div>
  );
}

export function StepInspector({ step, index, count, onChange, onMove, onDuplicate, onDelete, onAddText, onSelectText, selectedTextId, scene, onSceneChange, onApplySpeedToAll }) {
  const fp = step.focalPoint;
  const ts = step.transitionSettings || {};
  const setFocal = (patch) => onChange({ focalPoint: { ...fp, ...patch } });
  return (
    <div>
      <div className="flex items-center justify-between gap-2 border-b border-ink-700/70 px-5 py-3">
        <span className="text-sm font-medium text-white">Step {index + 1} <span className="text-ink-400">of {count}</span></span>
        <div className="flex gap-1">
          <Button size="icon-sm" variant="ghost" disabled={index === 0} onClick={() => onMove(-1)} title="Move earlier" aria-label="Move step earlier"><ArrowUp className="size-4" /></Button>
          <Button size="icon-sm" variant="ghost" disabled={index === count - 1} onClick={() => onMove(1)} title="Move later" aria-label="Move step later"><ArrowDown className="size-4" /></Button>
          <Button size="icon-sm" variant="ghost" onClick={onDuplicate} title="Duplicate step" aria-label="Duplicate step"><Copy className="size-4" /></Button>
          <Button size="icon-sm" variant="danger-ghost" disabled={count <= 1} onClick={onDelete} title="Delete step" aria-label="Delete step"><Trash2 className="size-4" /></Button>
        </div>
      </div>

      {scene && onSceneChange && (
        <Block title="Zoom speed (this scene)">
          <ZoomSpeedControl scene={scene} onChange={onSceneChange} onApplyToAll={onApplySpeedToAll} compact />
        </Block>
      )}

      <Block title="Scroll position">
        <RangeField label="Scroll progress" value={step.progress} min={0} max={1} step={0.01} scale={100} suffix="%" hint="How far through this scene's scroll the step is reached." onChange={(v) => onChange({ progress: v })} />
      </Block>

      <Block title="Zoom">
        <div className="grid grid-cols-5 gap-1.5">
          {ZOOM_PRESETS.map((z) => (
            <button
              key={z}
              type="button"
              onClick={() => onChange({ zoomLevel: z })}
              className={cx('h-9 rounded-lg text-[13px] font-medium tabular-nums transition-colors', Math.abs(step.zoomLevel - z) < 0.001 ? 'bg-accent-500 text-white' : 'bg-ink-750 text-ink-200 hover:bg-ink-700')}
            >
              {z}x
            </button>
          ))}
        </div>
        <RangeField label="Custom zoom" value={step.zoomLevel} min={1} max={3} step={0.05} suffix="x" onChange={(v) => onChange({ zoomLevel: Math.round(v * 100) / 100 })} />
      </Block>

      <Block
        title="Focal point"
        right={<button type="button" onClick={() => setFocal({ x: 0.5, y: 0.5 })} className="text-xs font-medium text-accent-300 hover:text-accent-400">Center</button>}
      >
        <p className="-mt-1 flex items-center gap-2 text-xs text-ink-400"><Crosshair className="size-3.5" />Click the image in Focal point view, or type values.</p>
        <div className="grid grid-cols-2 gap-3">
          <div><span className="label">X</span><NumberInput value={fp.x} min={0} max={100} step={0.5} scale={100} suffix="%" onChange={(v) => setFocal({ x: v })} aria-label="Focal X" /></div>
          <div><span className="label">Y</span><NumberInput value={fp.y} min={0} max={100} step={0.5} scale={100} suffix="%" onChange={(v) => setFocal({ y: v })} aria-label="Focal Y" /></div>
        </div>
        <div>
          <span className="label">Where it sits on screen</span>
          <div className="flex items-start gap-4">
            <div className="grid shrink-0 grid-cols-3 gap-1 rounded-lg border border-ink-700 bg-ink-950 p-1.5" role="group" aria-label="Screen position presets">
              {THIRDS.map((y) => THIRDS.map((x) => {
                const on = Math.abs(fp.targetPositionX - x) < 0.01 && Math.abs(fp.targetPositionY - y) < 0.01;
                return (
                  <button
                    key={`${x}-${y}`}
                    type="button"
                    onClick={() => setFocal({ targetPositionX: Math.round(x * 10000) / 10000, targetPositionY: Math.round(y * 10000) / 10000 })}
                    className={cx('size-6 rounded', on ? 'bg-accent-500' : 'bg-ink-750 hover:bg-ink-600')}
                    aria-label={`Screen position ${Math.round(x * 100)}%, ${Math.round(y * 100)}%`}
                  />
                );
              }))}
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <div><NumberInput value={fp.targetPositionX} min={0} max={100} step={1} scale={100} suffix="% X" onChange={(v) => setFocal({ targetPositionX: v })} aria-label="Screen position X" /></div>
              <div><NumberInput value={fp.targetPositionY} min={0} max={100} step={1} scale={100} suffix="% Y" onChange={(v) => setFocal({ targetPositionY: v })} aria-label="Screen position Y" /></div>
            </div>
          </div>
        </div>
      </Block>

      <Block title="Camera move into this step">
        <Field label="Easing">
          <Select value={ts.easing || 'power2.inOut'} onChange={(v) => onChange({ transitionSettings: { ...ts, easing: v } })} options={EASINGS} />
        </Field>
        <RangeField
          label="Move duration"
          value={ts.duration ?? 1}
          min={0.05}
          max={1}
          step={0.05}
          scale={100}
          suffix="%"
          hint="Share of the scroll since the previous step used to move. The rest holds still first."
          onChange={(v) => onChange({ transitionSettings: { ...ts, duration: v } })}
        />
        <RangeField
          label="Motion blur"
          value={ts.blur ?? 0}
          min={0}
          max={20}
          step={1}
          suffix="px"
          hint="Softens the image while the camera travels to this step, then snaps back into focus. Good for long pans."
          onChange={(v) => onChange({ transitionSettings: { ...ts, blur: v } })}
        />
      </Block>

      <Block title={`Text in this step (${step.textElements.length})`} right={<Button size="sm" icon={Plus} onClick={onAddText}>Add</Button>}>
        {step.textElements.length === 0 ? (
          <p className="text-xs text-ink-400">No text. Add text that reveals when the viewer scrolls to this step.</p>
        ) : (
          <ul className="space-y-1">
            {step.textElements.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => onSelectText(t.id)}
                  className={cx('flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-sm', t.id === selectedTextId ? 'border-accent-500/60 bg-accent-500/10 text-white' : 'border-ink-700 text-ink-200 hover:border-ink-500')}
                >
                  <Type className="size-4 shrink-0 text-ink-400" />
                  <span className="truncate">{t.content?.trim() || <em className="text-rose-300">Empty text</em>}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Block>
    </div>
  );
}

export function SceneSettings({ scene, index, isLast, onChange, onApplyToAll }) {
  const tr = scene.transition || { type: 'crossfade', duration: 0.8 };
  return (
    <div>
      <Block title={`Scene ${index + 1}`}>
        <Field label="Scene name (optional)">
          <Input value={scene.title || ''} maxLength={200} placeholder={`Scene ${index + 1}`} onChange={(e) => onChange({ title: e.target.value })} />
        </Field>
        <Field label="Image credit" htmlFor={`scene-credit-${scene.sceneId}`} hint="Viewers see it when they hover the (i) icon at the bottom right of the image. Leave empty for no icon.">
          <ItalicTextarea
            id={`scene-credit-${scene.sceneId}`}
            rows={3}
            maxLength={IMAGE_CREDIT_MAX}
            value={scene.imageCredit || ''}
            placeholder="Title; artist; date; medium; size. Museum, city"
            onChange={(v) => onChange({ imageCredit: v })}
          />
        </Field>
        <dl className="grid grid-cols-2 gap-y-1 text-xs text-ink-400">
          <dt>Image</dt><dd className="text-right text-ink-200 tabular-nums">{scene.imageWidth}×{scene.imageHeight}</dd>
          <dt>Aspect</dt><dd className="text-right text-ink-200 tabular-nums">{(scene.imageWidth / scene.imageHeight).toFixed(2)}</dd>
        </dl>
      </Block>
      <Block title="Zoom speed">
        <ZoomSpeedControl scene={scene} onChange={onChange} onApplyToAll={onApplyToAll} />
      </Block>
      <Block title="Framing">
        <div>
          <span className="label">Image fit</span>
          <Segmented className="w-full" value={scene.fit || 'cover'} onChange={(v) => onChange({ fit: v })} options={[{ value: 'cover', label: 'Fill screen' }, { value: 'contain', label: 'Show whole image' }]} />
        </div>
        <div>
          <span className="label">Scene opening</span>
          <Segmented
            className="w-full"
            value={scene.openWithFullImage === false ? 'step' : 'full'}
            onChange={(v) => onChange({ openWithFullImage: v === 'full' })}
            options={[{ value: 'full', label: 'Whole image first' }, { value: 'step', label: 'Start at step 1' }]}
          />
          <p className="mt-1.5 text-xs text-ink-400">
            {scene.openWithFullImage === false
              ? 'The scene appears already framed like step 1.'
              : 'The scene appears showing the whole image, then scrolling zooms into step 1 and on through the next steps.'}
          </p>
        </div>
      </Block>
      <Block title="Overlay">
        <ColorField label="Overlay color" value={scene.overlayColor || '#000000'} onChange={(v) => onChange({ overlayColor: v })} />
        <RangeField
          label="Overlay opacity"
          value={scene.overlayOpacity ?? 0}
          min={0}
          max={0.95}
          step={0.01}
          scale={100}
          suffix="%"
          hint="Darkens this scene's image only, so its text stays readable. 0% = off."
          onChange={(v) => onChange({ overlayOpacity: v })}
        />
      </Block>
      <Block title="Transition to next scene">
        {isLast ? (
          <p className="text-xs text-ink-400">This is the last scene. The story ends with the completion screen.</p>
        ) : (
          <>
            <Select value={tr.type} onChange={(v) => onChange({ transition: { ...tr, type: v } })} options={TRANSITION_TYPES} aria-label="Transition type" />
            <RangeField
              label="Transition length"
              value={tr.duration}
              min={0.2}
              max={2}
              step={0.1}
              suffix="vh"
              hint={tr.type === 'slideOver' ? '1 vh moves the next image exactly with the scroll, like a page.' : undefined}
              onChange={(v) => onChange({ transition: { ...tr, duration: v } })}
            />
          </>
        )}
      </Block>
    </div>
  );
}

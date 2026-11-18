import { useEffect, useMemo, useRef, useState } from 'react';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AlertCircle, Copy, Crosshair, GripVertical, Monitor, Plus, Trash2 } from 'lucide-react';
import { OPENING_LENGTH, stageUnit } from '@shared/engine/constants.js';
import { hasOpening, sortSteps } from '@shared/engine/camera.js';
import { cloneScene, collectImageIds, createStep, createTextElement, uid } from '@shared/engine/defaults.js';
import { SceneFrame } from '@shared/react/SceneFrame.jsx';
import { TextElementView } from '@shared/react/TextElementView.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Segmented } from '../../components/ui/Fields.jsx';
import { ConfirmDialog } from '../../components/ui/Modal.jsx';
import { EmptyState } from '../../components/ui/Misc.jsx';
import { uploadsApi } from '../../lib/api.js';
import { cx } from '../../lib/utils.js';
import StageCanvas from './StageCanvas.jsx';
import FocalCanvas from './FocalCanvas.jsx';
import StepTimeline from './StepTimeline.jsx';
import TextInspector from './TextInspector.jsx';
import { SceneSettings, StepInspector } from './StepInspector.jsx';
import { PanelTabs, StageControls } from './EditorToolbar.jsx';
import { textOps } from './textOps.js';

const round2 = (v) => Math.round(v * 100) / 100;

function SceneItem({ scene, index, active, hasIssues, onSelect, onDuplicate, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: scene.sceneId });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cx('w-60 shrink-0 lg:w-auto', isDragging && 'relative z-10')}>
      <div className={cx('group flex items-center gap-2 rounded-xl border p-2 transition-colors', active ? 'border-accent-500 bg-accent-500/10' : 'border-ink-700/80 bg-ink-850 hover:border-ink-500', isDragging && 'shadow-pop')}>
        <button type="button" className="cursor-grab touch-none p-0.5 text-ink-500 hover:text-ink-200 active:cursor-grabbing" aria-label={`Drag to reorder scene ${index + 1}`} {...attributes} {...listeners}>
          <GripVertical className="size-4" />
        </button>
        <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
          <div className="relative h-11 w-16 shrink-0 overflow-hidden rounded-md bg-ink-800">
            <img src={scene.thumbUrl} alt="" className="size-full object-cover" draggable={false} />
            <span className="absolute bottom-0.5 left-0.5 rounded bg-black/70 px-1 text-[10px] font-semibold text-white">{index + 1}</span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 truncate text-[13px] font-medium text-white">
              {scene.title || `Scene ${index + 1}`}
              {hasIssues && <AlertCircle className="size-3.5 shrink-0 text-amber-400" aria-label="Has problems to fix before publishing" />}
            </div>
            <div className="text-[11px] text-ink-400">{scene.animationSteps.length} steps · {scene.scrollLength ?? 3}vh</div>
          </div>
        </button>
        <div className="flex flex-col transition-opacity lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100">
          <button type="button" onClick={onDuplicate} className="rounded p-1 text-ink-400 hover:text-white" aria-label={`Duplicate scene ${index + 1}`} title="Duplicate scene"><Copy className="size-3.5" /></button>
          <button type="button" onClick={onDelete} className="rounded p-1 text-ink-400 hover:text-rose-300" aria-label={`Delete scene ${index + 1}`} title="Delete scene"><Trash2 className="size-3.5" /></button>
        </div>
      </div>
    </li>
  );
}

/** Small exact render of the selected step (camera + settled text), shown in focal view. */
function MiniPreview({ scene, step, aspect, focalOverride }) {
  const width = 300;
  const height = Math.round(width / aspect);
  const s = focalOverride
    ? { ...scene, animationSteps: scene.animationSteps.map((x) => (x.stepId === step.stepId ? { ...x, focalPoint: { ...x.focalPoint, ...focalOverride } } : x)) }
    : scene;
  const unit = stageUnit(width, height);
  return (
    <div className="pointer-events-none absolute right-2 bottom-2 hidden origin-bottom-right sm:block scale-[0.55] overflow-hidden rounded-lg shadow-pop ring-1 ring-white/15 sm:right-4 sm:bottom-4 sm:scale-75 2xl:scale-100">
      <SceneFrame
        scene={s}
        progress={step.progress}
        width={width}
        height={height}
        mode="edit"
        textLayer={step.textElements.map((t) => <TextElementView key={t.id} text={t} unitPx={unit} />)}
      />
      <span className="absolute top-1.5 left-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">Viewer · step at {Math.round(step.progress * 100)}%</span>
    </div>
  );
}

export default function StepScenes({ story, update, aspect, setAspect, issues }) {
  const scenes = story.scenes;
  const [sceneId, setSceneId] = useState(scenes[0]?.sceneId);
  const scene = scenes.find((s) => s.sceneId === sceneId) || scenes[0];
  const sceneIndex = scenes.indexOf(scene);
  const steps = useMemo(() => sortSteps(scene?.animationSteps || []), [scene]);
  const [stepId, setStepId] = useState(steps[0]?.stepId);
  const step = steps.find((s) => s.stepId === stepId) || steps[0];
  const stepIndex = steps.indexOf(step);
  const [textId, setTextId] = useState(null);
  const text = step?.textElements.find((t) => t.id === textId) || null;

  const [view, setView] = useState('focal');
  const [tab, setTab] = useState('step');
  const [zoom, setZoom] = useState(1);
  const [preview, setPreview] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [dragFocal, setDragFocal] = useState(null);
  const [focusSignal, setFocusSignal] = useState(0);
  const [toDelete, setToDelete] = useState(null);
  const raf = useRef(0);

  // Keep selection valid when scenes/steps change.
  useEffect(() => { if (!scene && scenes[0]) setSceneId(scenes[0].sceneId); }, [scene, scenes]);
  useEffect(() => { if (scene && !scene.animationSteps.some((s) => s.stepId === stepId)) setStepId(steps[0]?.stepId); }, [scene, stepId, steps]);
  useEffect(() => { if (textId && !text) setTextId(null); }, [text, textId]);

  // Scene playback (scrubs the preview playhead).
  useEffect(() => {
    if (!playing || !scene) return undefined;
    const duration = (scene.scrollLength ?? 3) * 1600;
    // Playing from the start includes the opening (whole image → step 1), as -1…0.
    const lead = hasOpening(scene) ? (OPENING_LENGTH * 1600) / duration : 0;
    const from = preview == null || preview >= 1 ? -lead : preview;
    const t0 = performance.now() - from * duration;
    const tick = (now) => {
      const t = (now - t0) / duration;
      const p = Math.min(1, t < 0 ? t / lead : t);
      setPreview(p);
      if (p < 1) raf.current = requestAnimationFrame(tick);
      else setPlaying(false);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, scene?.sceneId]);

  const stopPreview = () => {
    setPlaying(false);
    setPreview(null);
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  if (!scene) {
    return (
      <div className="grid h-full place-items-center p-8">
        <EmptyState icon={Monitor} title="No scenes yet" description="Upload story images in step 1. Each image becomes a scene you can animate here." />
      </div>
    );
  }

  const updScene = (fn) => update((d) => { const s = d.scenes.find((x) => x.sceneId === scene.sceneId); if (s) fn(s); });
  const updStep = (fn) => updScene((s) => { const st = s.animationSteps.find((x) => x.stepId === step.stepId); if (st) fn(st); });
  const updTexts = (fn) => updStep((st) => fn(st.textElements));

  const selectStep = (id) => {
    stopPreview();
    setStepId(id);
    setTextId(null);
    setTab('step');
  };

  const freeProgress = (p, ignoreId) => {
    let v = round2(p);
    const taken = (x) => steps.some((s) => s.stepId !== ignoreId && Math.abs(s.progress - x) < 0.005);
    for (let i = 0; taken(v) && i < 100; i += 1) v = round2(v < 1 ? v + 0.01 : v - 0.01);
    return Math.min(1, Math.max(0, v));
  };

  const addStep = () => {
    const ps = steps.map((s) => s.progress);
    let p;
    if (!ps.length || ps[0] > 0.005) p = 0;
    else if (ps[ps.length - 1] < 0.995) p = 1;
    else {
      let best = 0;
      for (let i = 1; i < ps.length; i += 1) if (ps[i] - ps[i - 1] > ps[best + 1] - ps[best]) best = i - 1;
      p = (ps[best] + ps[best + 1]) / 2;
    }
    p = freeProgress(p);
    const before = [...steps].reverse().find((s) => s.progress <= p) || steps[0];
    const ns = createStep({
      progress: p,
      zoomLevel: before?.zoomLevel ?? 1,
      focalPoint: before ? { ...before.focalPoint } : undefined,
    });
    updScene((s) => s.animationSteps.push(ns));
    selectStep(ns.stepId);
  };

  const duplicateStep = () => {
    const next = steps[stepIndex + 1];
    const p = freeProgress(next ? (step.progress + next.progress) / 2 : Math.min(1, step.progress + 0.1));
    const copy = JSON.parse(JSON.stringify(step));
    copy.stepId = uid('step');
    copy.progress = p;
    copy.textElements = copy.textElements.map((t) => ({ ...t, id: uid('txt') }));
    updScene((s) => s.animationSteps.push(copy));
    selectStep(copy.stepId);
  };

  const moveStep = (dir) => {
    const other = steps[stepIndex + dir];
    if (!other) return;
    updScene((s) => {
      const a = s.animationSteps.find((x) => x.stepId === step.stepId);
      const b = s.animationSteps.find((x) => x.stepId === other.stepId);
      [a.progress, b.progress] = [b.progress, a.progress];
    });
  };

  const addText = () => {
    const n = step.textElements.length;
    const t = createTextElement({ content: n ? 'Another line of the story' : 'Write this moment of the story', positionY: Math.min(0.85, 0.62 + n * 0.1), zIndex: textOps.nextZ(step.textElements) });
    updTexts((list) => list.push(t));
    stopPreview();
    setTextId(t.id);
    setTab('text');
    setView('stage');
  };

  const duplicateScene = (s) => {
    const copy = cloneScene(s);
    update((d) => {
      const i = d.scenes.findIndex((x) => x.sceneId === s.sceneId);
      d.scenes.splice(i + 1, 0, { ...copy });
      d.scenes.forEach((x, k) => { x.order = k; });
    });
    setSceneId(copy.sceneId);
  };

  const deleteScene = () => {
    const s = toDelete;
    setToDelete(null);
    const after = { ...story, scenes: scenes.filter((x) => x.sceneId !== s.sceneId) };
    update((d) => {
      d.scenes = d.scenes.filter((x) => x.sceneId !== s.sceneId).map((x, k) => ({ ...x, order: k }));
    });
    if (!collectImageIds(after).includes(s.imageId)) uploadsApi.remove(s.imageId).catch(() => {});
  };

  const onSceneDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const from = scenes.findIndex((x) => x.sceneId === active.id);
    const to = scenes.findIndex((x) => x.sceneId === over.id);
    update((d) => {
      d.scenes = arrayMove(d.scenes, from, to).map((x, k) => ({ ...x, order: k }));
    });
  };

  const sceneHasIssues = (i) => issues.some((e) => e.path.startsWith(`scenes.${i}.`));
  const showStage = view === 'stage' || preview != null;

  if (!step) {
    return (
      <div className="grid h-full place-items-center p-8">
        <EmptyState icon={Crosshair} title="This scene has no animation steps" description="Add a step to set its zoom and focal point." action={<Button variant="primary" icon={Plus} onClick={addStep}>Add first step</Button>} />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-x-hidden overflow-y-auto lg:flex-row lg:overflow-hidden">
      {/* LEFT: scenes */}
      <aside className="panel flex w-full shrink-0 flex-col border-b lg:w-56 lg:border-r lg:border-b-0 xl:w-64">
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <h3 className="section-title">Scenes ({scenes.length})</h3>
        </div>
        <ul className="flex gap-2 overflow-x-auto px-3 pb-3 lg:flex-1 lg:flex-col lg:overflow-x-visible lg:overflow-y-auto">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onSceneDragEnd}>
            <SortableContext items={scenes.map((s) => s.sceneId)} strategy={verticalListSortingStrategy}>
              {scenes.map((s, i) => (
                <SceneItem
                  key={s.sceneId}
                  scene={s}
                  index={i}
                  active={s.sceneId === scene.sceneId}
                  hasIssues={sceneHasIssues(i)}
                  onSelect={() => { stopPreview(); setSceneId(s.sceneId); setTextId(null); setTab('step'); }}
                  onDuplicate={() => duplicateScene(s)}
                  onDelete={() => setToDelete(s)}
                />
              ))}
            </SortableContext>
          </DndContext>
        </ul>
        <p className="hidden border-t border-ink-700/70 px-4 py-3 text-[11px] lg:block leading-relaxed text-ink-500">Scenes play top to bottom. Add more images in step 1.</p>
      </aside>

      {/* CENTER */}
      <section className="flex h-[72vh] min-h-[500px] sm:h-[80vh] min-w-0 shrink-0 flex-col lg:h-auto lg:min-h-0 lg:flex-1 lg:shrink">
        <div className="flex min-h-12 shrink-0 flex-wrap items-center justify-between gap-2 border-b border-ink-700/70 bg-ink-900 px-3 py-2 sm:px-4">
          <Segmented
            value={showStage ? 'stage' : 'focal'}
            onChange={(v) => { stopPreview(); setView(v); }}
            options={[{ value: 'focal', label: 'Focal point', icon: Crosshair }, { value: 'stage', label: 'Stage & text', icon: Monitor }]}
          />
          <div className="flex items-center gap-2">
            {showStage && <Button size="sm" icon={Plus} onClick={addText}>Add text</Button>}
            <StageControls aspect={aspect} onAspect={setAspect} zoom={zoom} onZoom={setZoom} />
          </div>
        </div>

        <div className="relative flex min-h-0 flex-1 flex-col">
          {showStage ? (
            <StageCanvas
              aspect={aspect}
              zoom={zoom}
              texts={preview != null ? [] : step.textElements}
              selectedId={textId}
              onSelect={(id) => { setTextId(id); if (id) setTab('text'); }}
              onChange={(id, patch) => updTexts((list) => textOps.patch(list, id, patch))}
              onDelete={(id) => { updTexts((list) => textOps.remove(list, id)); setTextId(null); }}
              onDuplicate={(id) => { const nid = uid('txt'); updTexts((list) => textOps.duplicate(list, id, nid)); setTextId(nid); }}
              onEditText={() => { setTab('text'); setFocusSignal((n) => n + 1); }}
              renderBackground={({ width, height }) => (
                <SceneFrame scene={scene} progress={preview ?? step.progress} width={width} height={height} mode={preview != null ? 'play' : 'edit'} />
              )}
              overlay={preview != null && (
                <span className="pointer-events-none absolute top-2 right-2 rounded bg-amber-300 px-2 py-0.5 text-[11px] font-semibold text-black">Preview {Math.round(preview * 100)}%</span>
              )}
            />
          ) : (
            <>
              <FocalCanvas
                scene={scene}
                steps={steps}
                step={step}
                aspect={aspect}
                onChange={(n) => updStep((st) => { st.focalPoint.x = n.x; st.focalPoint.y = n.y; })}
                onDragFocal={setDragFocal}
                onSelectStep={selectStep}
              />
              <MiniPreview scene={scene} step={step} aspect={aspect} focalOverride={dragFocal} />
            </>
          )}
        </div>

        <StepTimeline
          steps={steps}
          selectedId={step.stepId}
          onSelect={selectStep}
          onMoveStep={(id, p) => updScene((s) => { const st = s.animationSteps.find((x) => x.stepId === id); if (st) st.progress = freeProgress(p, id); })}
          onAddStep={addStep}
          preview={preview}
          onScrub={(p) => { setPlaying(false); setPreview(p); }}
          playing={playing}
          onTogglePlay={() => setPlaying((v) => !v)}
        />
      </section>

      {/* RIGHT */}
      <aside className="panel flex w-full shrink-0 flex-col border-t lg:w-[300px] lg:border-t-0 lg:border-l xl:w-[340px]">
        <PanelTabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'step', label: `Step ${stepIndex + 1}` },
            { value: 'text', label: 'Text', disabled: !text },
            { value: 'scene', label: 'Scene' },
          ]}
        />
        <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
          {tab === 'step' && (
            <StepInspector
              step={step}
              index={stepIndex}
              count={steps.length}
              onChange={(patch) => { stopPreview(); updStep((st) => Object.assign(st, patch)); }}
              onMove={moveStep}
              onDuplicate={duplicateStep}
              onDelete={() => { updScene((s) => { s.animationSteps = s.animationSteps.filter((x) => x.stepId !== step.stepId); }); setStepId(steps[Math.max(0, stepIndex - 1)]?.stepId); }}
              onAddText={addText}
              selectedTextId={textId}
              onSelectText={(id) => { setTextId(id); setTab('text'); setView('stage'); stopPreview(); }}
            />
          )}
          {tab === 'text' && text && (
            <TextInspector
              text={text}
              timing="scroll"
              focusSignal={focusSignal}
              onChange={(patch) => updTexts((list) => textOps.patch(list, text.id, patch))}
              onDuplicate={() => { const nid = uid('txt'); updTexts((list) => textOps.duplicate(list, text.id, nid)); setTextId(nid); }}
              onDelete={() => { updTexts((list) => textOps.remove(list, text.id)); setTextId(null); setTab('step'); }}
              onLayer={(dir) => updTexts((list) => textOps.layer(list, text.id, dir))}
            />
          )}
          {tab === 'scene' && (
            <SceneSettings scene={scene} index={sceneIndex} isLast={sceneIndex === scenes.length - 1} onChange={(patch) => updScene((s) => Object.assign(s, patch))} />
          )}
        </div>
      </aside>

      <ConfirmDialog
        open={!!toDelete}
        title="Delete this scene?"
        description="The scene, its image and all its animation steps will be removed from the story."
        confirmLabel="Delete scene"
        onConfirm={deleteScene}
        onClose={() => setToDelete(null)}
      />
    </div>
  );
}

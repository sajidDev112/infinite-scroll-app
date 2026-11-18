import { useRef, useState } from 'react';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AlertTriangle, GripVertical, ImagePlus, Loader2, RefreshCw, RotateCcw, Trash2, UploadCloud, X } from 'lucide-react';
import { ACCEPT, MAX_MB } from './useUploadQueue.js';
import { cx } from '../../lib/utils.js';

function SortableTile({ scene, index, onRemove, onReplace, replacing }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: scene.sceneId });
  const fileRef = useRef(null);
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cx('group relative aspect-[4/3] overflow-hidden rounded-xl border border-ink-700 bg-ink-800', isDragging && 'z-10 ring-2 ring-accent-500 shadow-pop')}
    >
      <img src={scene.thumbUrl || scene.imageUrl} alt={`Scene ${index + 1}`} className="size-full object-cover" draggable={false} />
      <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-transparent to-black/65" />
      <span className="absolute top-2 left-2 rounded-md bg-black/60 px-2 py-0.5 text-xs font-semibold text-white tabular-nums backdrop-blur">{index + 1}</span>
      <button
        type="button"
        className="absolute top-1.5 right-1.5 cursor-grab rounded-md bg-black/50 p-1.5 text-white/90 backdrop-blur hover:bg-black/75 active:cursor-grabbing"
        aria-label={`Drag to reorder scene ${index + 1}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <div className="absolute inset-x-2 bottom-2 flex items-center justify-between gap-1">
        <span className="truncate text-[11px] text-white/80 tabular-nums">{scene.imageWidth}×{scene.imageHeight}</span>
        <div className="flex gap-1 opacity-100 transition-opacity lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100">
          <button type="button" onClick={() => fileRef.current?.click()} className="rounded-md bg-black/60 p-1.5 text-white backdrop-blur hover:bg-black/85" title="Replace image" aria-label={`Replace image ${index + 1}`}>
            <RefreshCw className="size-3.5" />
          </button>
          <button type="button" onClick={() => onRemove(scene)} className="rounded-md bg-black/60 p-1.5 text-rose-300 backdrop-blur hover:bg-rose-600 hover:text-white" title="Remove image" aria-label={`Remove image ${index + 1}`}>
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.[0]) onReplace(scene, e.target.files[0]);
          e.target.value = '';
        }}
      />
      {replacing && (
        <div className="absolute inset-0 grid place-items-center bg-black/70 text-white">
          <div className="w-3/4 text-center text-xs">
            <Loader2 className="mx-auto mb-2 size-5 animate-spin" />
            Replacing… {replacing.progress}%
            <div className="mt-2 h-1 overflow-hidden rounded bg-white/20"><div className="h-full bg-accent-400" style={{ width: `${replacing.progress}%` }} /></div>
          </div>
        </div>
      )}
    </div>
  );
}

function UploadTile({ item, onRetry, onCancel }) {
  const failed = item.status === 'error';
  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-ink-700 bg-ink-800">
      <img src={item.preview} alt="" className={cx('size-full object-cover', failed ? 'opacity-25' : 'opacity-45')} />
      <div className="absolute inset-0 flex flex-col justify-end p-3">
        <p className="truncate text-xs font-medium text-white">{item.name}</p>
        {failed ? (
          <>
            <p className="mt-1 line-clamp-2 flex items-start gap-1 text-[11px] text-rose-300"><AlertTriangle className="mt-px size-3 shrink-0" />{item.error}</p>
            <div className="mt-2 flex gap-1.5">
              <button type="button" onClick={() => onRetry(item.key)} className="flex items-center gap-1 rounded-md bg-white/15 px-2 py-1 text-[11px] text-white hover:bg-white/25"><RotateCcw className="size-3" />Retry</button>
              <button type="button" onClick={() => onCancel(item.key)} className="rounded-md bg-white/10 px-2 py-1 text-[11px] text-white hover:bg-white/20">Dismiss</button>
            </div>
          </>
        ) : (
          <>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15">
              <div className="h-full rounded-full bg-accent-400 transition-[width] duration-200" style={{ width: `${item.progress}%` }} />
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[11px] text-white/75">
              <span>{item.status === 'queued' ? 'Waiting…' : item.progress >= 100 ? 'Optimizing…' : `${item.progress}%`}</span>
              <button type="button" onClick={() => onCancel(item.key)} className="rounded p-0.5 hover:bg-white/15" aria-label={`Cancel ${item.name}`}><X className="size-3.5" /></button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Story images = scenes. Multi-file upload with per-file progress, drag-and-drop
 * reordering, replace and remove.
 */
export default function ImageUploader({ scenes, queue, onAddFiles, onReorder, onRemove, onReplace, replacing, error }) {
  const [over, setOver] = useState(false);
  const inputRef = useRef(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = ({ active, over: target }) => {
    if (!target || active.id === target.id) return;
    const from = scenes.findIndex((s) => s.sceneId === active.id);
    const to = scenes.findIndex((s) => s.sceneId === target.id);
    onReorder(arrayMove(scenes, from, to).map((s) => s.sceneId));
  };

  return (
    <div className="flex flex-1 flex-col">
      <div
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes('Files')) {
            e.preventDefault();
            setOver(true);
          }
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (e.dataTransfer.files?.length) onAddFiles(e.dataTransfer.files);
        }}
        className={cx(
          'flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 text-center transition-colors',
          // Empty: a big drop area filling the panel. With images: compact, tiles below.
          scenes.length || queue.items.length ? 'py-5' : 'min-h-[14rem] flex-1 py-8',
          over ? 'border-accent-400 bg-accent-500/10' : error ? 'border-rose-500/50 bg-rose-500/5' : 'border-ink-600 bg-ink-900/60 hover:border-ink-500',
        )}
      >
        <div className="grid size-12 place-items-center rounded-xl bg-ink-800 text-accent-300 ring-1 ring-ink-700"><UploadCloud className="size-6" /></div>
        <p className="mt-4 text-sm font-medium text-white">Drag images here, or <button type="button" onClick={() => inputRef.current?.click()} className="text-accent-300 underline-offset-4 hover:underline">browse</button></p>
        <p className="mt-1 text-xs text-ink-400">JPG, PNG or WebP · up to {MAX_MB} MB each · each image becomes one scene</p>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) onAddFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>
      {error && <p className="mt-2 text-xs text-rose-400" role="alert">{error}</p>}

      {(scenes.length > 0 || queue.items.length > 0) && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={scenes.map((s) => s.sceneId)} strategy={rectSortingStrategy}>
              {scenes.map((s, i) => (
                <SortableTile key={s.sceneId} scene={s} index={i} onRemove={onRemove} onReplace={onReplace} replacing={replacing[s.sceneId]} />
              ))}
            </SortableContext>
          </DndContext>
          {queue.items.map((it) => <UploadTile key={it.key} item={it} onRetry={queue.retry} onCancel={queue.cancel} />)}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-ink-600 text-sm text-ink-300 transition-colors hover:border-accent-400 hover:text-white"
          >
            <ImagePlus className="size-5" />
            Add images
          </button>
        </div>
      )}
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { ImageIcon, Loader2, Trash2, Upload } from 'lucide-react';
import { collectImageIds, createScene, imageRef } from '@shared/engine/defaults.js';
import { Field, Input, Select, Textarea } from '../../components/ui/Fields.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { ConfirmDialog } from '../../components/ui/Modal.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { uploadsApi, errorMessage } from '../../lib/api.js';
import ImageUploader from './ImageUploader.jsx';
import { ACCEPT, checkFile, useUploadQueue } from './useUploadQueue.js';

/** Delete an uploaded file only when nothing in the local story uses it anymore.
 *  The server additionally refuses if any saved story still references it. */
function releaseImage(imageId, storyAfter) {
  if (!imageId || collectImageIds(storyAfter).includes(imageId)) return;
  uploadsApi.remove(imageId).catch(() => {});
}

function CoverPicker({ story, update }) {
  const toast = useToast();
  const fileRef = useRef(null);
  const [progress, setProgress] = useState(null);
  const [picking, setPicking] = useState(false);
  const cover = story.coverImage;

  const upload = async (file) => {
    const err = checkFile(file);
    if (err) return toast.error(err);
    setProgress(0);
    try {
      const img = await uploadsApi.upload(file, setProgress, undefined, { storyId: story.id });
      const old = story.coverImage?.imageId;
      update((d) => { d.coverImage = imageRef(img); });
      releaseImage(old, { ...story, coverImage: imageRef(img) });
    } catch (e) {
      toast.error(errorMessage(e, 'Cover upload failed.'));
    } finally {
      setProgress(null);
    }
  };

  const clear = () => {
    const old = cover?.imageId;
    update((d) => { d.coverImage = null; });
    releaseImage(old, { ...story, coverImage: null });
  };

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden rounded-xl border border-ink-700 bg-ink-900 sm:w-56">
          {cover ? (
            <img src={cover.thumbUrl || cover.url} alt="Cover" className="size-full object-cover" />
          ) : (
            <div className="flex size-full flex-col items-center justify-center gap-2 text-ink-500">
              <ImageIcon className="size-7" />
              <span className="px-2 text-center text-xs">No cover — first scene is used</span>
            </div>
          )}
          {progress !== null && (
            <div className="absolute inset-0 grid place-items-center bg-black/70 text-xs text-white">
              <div className="flex items-center gap-2"><Loader2 className="size-4 animate-spin" />{progress}%</div>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2 sm:flex-col sm:items-start">
          <Button size="sm" icon={Upload} onClick={() => fileRef.current?.click()} disabled={progress !== null}>Upload cover</Button>
          <Button size="sm" icon={ImageIcon} onClick={() => setPicking((p) => !p)} disabled={!story.scenes.length}>Pick from images</Button>
          {cover && <Button size="sm" variant="danger-ghost" icon={Trash2} onClick={clear}>Remove</Button>}
        </div>
      </div>
      {picking && (
        <div className="anim-pop mt-3 grid grid-cols-4 gap-2 rounded-xl border border-ink-700 bg-ink-900 p-3 sm:grid-cols-6">
          {story.scenes.map((s, i) => (
            <button
              key={s.sceneId}
              type="button"
              onClick={() => {
                const old = cover?.imageId;
                const ref = { imageId: s.imageId, url: s.imageUrl, thumbUrl: s.thumbUrl, width: s.imageWidth, height: s.imageHeight };
                update((d) => { d.coverImage = ref; });
                releaseImage(old, { ...story, coverImage: ref });
                setPicking(false);
              }}
              className="aspect-[4/3] overflow-hidden rounded-lg ring-accent-400 hover:ring-2"
              aria-label={`Use scene ${i + 1} image as cover`}
            >
              <img src={s.thumbUrl} alt="" className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}
      <input ref={fileRef} type="file" accept={ACCEPT} className="hidden" onChange={(e) => { if (e.target.files?.[0]) upload(e.target.files[0]); e.target.value = ''; }} />
    </div>
  );
}

export default function StepInfo({ story, update, errors: rawErrors, onBusyChange }) {
  const toast = useToast();
  // Errors from the last Continue attempt, hidden as soon as the field becomes valid.
  const errors = {
    title: story.title.trim() ? undefined : rawErrors.title,
    scenes: story.scenes.length ? undefined : rawErrors.scenes,
  };
  const [replacing, setReplacing] = useState({});
  const [toRemove, setToRemove] = useState(null);

  // Uploads can finish out of order; keep scenes in the order the files were chosen.
  const seqByScene = useRef(new Map());
  const queue = useUploadQueue((img, item) => {
    const scene = createScene(img, 0);
    seqByScene.current.set(scene.sceneId, item.seq);
    update((d) => {
      const at = d.scenes.findIndex((s) => (seqByScene.current.get(s.sceneId) ?? -1) > item.seq);
      // Insert a copy: immer freezes inserted objects, and StrictMode may run this recipe twice.
      d.scenes.splice(at < 0 ? d.scenes.length : at, 0, { ...scene });
      d.scenes.forEach((s, i) => { s.order = i; });
    });
  }, { storyId: story.id });
  const busy = queue.busy || Object.keys(replacing).length > 0;
  useEffect(() => { onBusyChange?.(busy); }, [busy, onBusyChange]);

  const addFiles = (files) => {
    const rejected = queue.add(files);
    rejected.forEach((m) => toast.error(m));
  };

  const reorder = (ids) => update((d) => {
    d.scenes = ids.map((id, i) => ({ ...d.scenes.find((s) => s.sceneId === id), order: i }));
  });

  const remove = () => {
    const scene = toRemove;
    setToRemove(null);
    const after = { ...story, scenes: story.scenes.filter((s) => s.sceneId !== scene.sceneId) };
    update((d) => {
      d.scenes = d.scenes.filter((s) => s.sceneId !== scene.sceneId).map((s, i) => ({ ...s, order: i }));
      if (d.intro?.imageId === scene.imageId && !d.scenes.some((s) => s.imageId === scene.imageId)) {
        Object.assign(d.intro, { imageId: null, imageUrl: null, thumbUrl: null, imageWidth: null, imageHeight: null });
      }
    });
    releaseImage(scene.imageId, after);
  };

  const replace = async (scene, file) => {
    const err = checkFile(file);
    if (err) return toast.error(err);
    setReplacing((r) => ({ ...r, [scene.sceneId]: { progress: 0 } }));
    try {
      const img = await uploadsApi.upload(file, (p) => setReplacing((r) => ({ ...r, [scene.sceneId]: { progress: p } })), undefined, { storyId: story.id });
      update((d) => {
        const s = d.scenes.find((x) => x.sceneId === scene.sceneId);
        if (!s) return;
        // Focal points are normalized, so existing animation steps stay valid.
        Object.assign(s, { imageId: img.id, imageUrl: img.url, thumbUrl: img.thumbUrl, imageWidth: img.width, imageHeight: img.height });
      });
      toast.success(`Scene image replaced. Animation steps were kept.`);
    } catch (e) {
      toast.error(errorMessage(e, 'Replace failed.'));
    } finally {
      setReplacing((r) => {
        const { [scene.sceneId]: _, ...rest } = r;
        return rest;
      });
    }
  };

  return (
    // Wide screens: details + cover on the left, a large image area on the right,
    // so everything fits on one screen. Narrower screens stack the cards.
    <div className="mx-auto max-w-[1760px] px-4 py-3 sm:px-6">
      <div className="grid gap-5 xl:grid-cols-[minmax(380px,460px)_1fr] xl:items-start">
        <section className="card space-y-3 p-5">
            <div className="space-y-3 border-b border-ink-800 pb-4">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-[15px] font-semibold text-white">Cover image</h2>
                <p className="text-xs text-ink-400">The large image on the story card</p>
              </div>
              <CoverPicker story={story} update={update} />
            </div>

            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-[15px] font-semibold text-white">Story details</h2>
              <p className="text-xs text-ink-400">Shown on the story card</p>
            </div>
            <Field label="Story title *" htmlFor="title" error={errors.title}>
              <Input id="title" value={story.title} maxLength={160} error={errors.title} placeholder="e.g. The Last Lighthouse" onChange={(e) => update((d) => { d.title = e.target.value; })} autoFocus={!story.id} />
            </Field>
            <Field label="Description" htmlFor="desc" hint={`${story.description?.length || 0}/2000`}>
              <Textarea id="desc" value={story.description} maxLength={2000} rows={2} placeholder="A short summary shown under the title." onChange={(e) => update((d) => { d.description = e.target.value; })} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Category" htmlFor="cat" hint="Optional. Used for filters.">
                <Input id="cat" value={story.category || ''} maxLength={60} placeholder="e.g. Travel" onChange={(e) => update((d) => { d.category = e.target.value; })} />
              </Field>
              <Field
                label="Status"
                htmlFor="status"
                hint={story.isPublished ? 'Active = visible to viewers.' : 'Publish to make it Active.'}
              >
                <Select
                  id="status"
                  value={story.status}
                  onChange={(v) => update((d) => { d.status = v; })}
                  options={[
                    { value: 'draft', label: 'Draft' },
                    { value: 'active', label: story.isPublished ? 'Active' : 'Active (publish first)', disabled: !story.isPublished },
                    { value: 'inactive', label: 'Inactive' },
                  ]}
                />
              </Field>
            </div>

        </section>

        <section className="card flex flex-col p-5">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-[15px] font-semibold text-white">Story images *</h2>
              <p className="mt-1 text-sm text-ink-400">Each image is one scene. Drag tiles to change the order scenes play in.</p>
            </div>
            <span className="shrink-0 text-sm text-ink-400 tabular-nums">{story.scenes.length} scene{story.scenes.length === 1 ? '' : 's'}</span>
          </div>
          <ImageUploader
            scenes={story.scenes}
            queue={queue}
            onAddFiles={addFiles}
            onReorder={reorder}
            onRemove={setToRemove}
            onReplace={replace}
            replacing={replacing}
            error={errors.scenes}
          />
        </section>
      </div>

      <ConfirmDialog
        open={!!toRemove}
        title="Remove this image?"
        description="Its scene and all of the scene's animation steps and text will be removed."
        confirmLabel="Remove image"
        onConfirm={remove}
        onClose={() => setToRemove(null)}
      />
    </div>
  );
}

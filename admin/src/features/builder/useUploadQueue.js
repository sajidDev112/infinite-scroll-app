import { useCallback, useEffect, useRef, useState } from 'react';
import { uploadsApi, errorMessage } from '../../lib/api.js';

export const ACCEPT = 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp';
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_MB = 15;
const CONCURRENCY = 3;

/** Client-side check before upload (the server re-validates by decoding). */
export function checkFile(file) {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (!TYPES.includes(file.type) && !['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
    return `${file.name}: only JPG, PNG and WebP images are supported.`;
  }
  if (file.size > MAX_MB * 1024 * 1024) return `${file.name} is larger than ${MAX_MB} MB.`;
  return null;
}

/**
 * Uploads files one request per file (so each gets its own progress bar),
 * up to 3 at a time. `onUploaded(image, item)` fires as each one finishes.
 */
/** `storyId` (once the story is saved) puts uploads straight into the story's folder. */
export function useUploadQueue(onUploaded, { storyId } = {}) {
  const [items, setItems] = useState([]);
  const seq = useRef(0);
  const active = useRef(0);
  const pending = useRef([]);
  const controllers = useRef(new Map());
  const cb = useRef(onUploaded);
  cb.current = onUploaded;
  const storyIdRef = useRef(storyId);
  storyIdRef.current = storyId;

  const patch = (key, p) => setItems((list) => list.map((it) => (it.key === key ? { ...it, ...p } : it)));

  const pump = useCallback(() => {
    while (active.current < CONCURRENCY && pending.current.length) {
      const item = pending.current.shift();
      active.current += 1;
      const ctrl = new AbortController();
      controllers.current.set(item.key, ctrl);
      patch(item.key, { status: 'uploading' });
      uploadsApi
        .upload(item.file, (progress) => patch(item.key, { progress }), ctrl.signal, { storyId: storyIdRef.current })
        .then((image) => {
          cb.current?.(image, item);
          setItems((list) => list.filter((it) => it.key !== item.key));
          URL.revokeObjectURL(item.preview);
        })
        .catch((e) => {
          if (ctrl.signal.aborted) return;
          patch(item.key, { status: 'error', error: errorMessage(e, 'Upload failed.') });
        })
        .finally(() => {
          controllers.current.delete(item.key);
          active.current -= 1;
          pump();
        });
    }
  }, []);

  const add = useCallback((files, meta = {}) => {
    const accepted = [];
    const rejected = [];
    [...files].forEach((file) => {
      const err = checkFile(file);
      if (err) rejected.push(err);
      else accepted.push({ key: `${Date.now()}-${Math.random().toString(36).slice(2)}`, seq: ++seq.current, file, name: file.name, preview: URL.createObjectURL(file), progress: 0, status: 'queued', meta });
    });
    if (accepted.length) {
      setItems((list) => [...list, ...accepted]);
      pending.current.push(...accepted);
      pump();
    }
    return rejected;
  }, [pump]);

  const retry = useCallback((key) => {
    setItems((list) => {
      const it = list.find((x) => x.key === key);
      if (it) {
        pending.current.push(it);
        queueMicrotask(pump);
      }
      return list.map((x) => (x.key === key ? { ...x, status: 'queued', progress: 0, error: '' } : x));
    });
  }, [pump]);

  const cancel = useCallback((key) => {
    controllers.current.get(key)?.abort();
    pending.current = pending.current.filter((x) => x.key !== key);
    setItems((list) => {
      const it = list.find((x) => x.key === key);
      if (it) URL.revokeObjectURL(it.preview);
      return list.filter((x) => x.key !== key);
    });
  }, []);

  useEffect(() => () => controllers.current.forEach((c) => c.abort()), []);

  return { items, add, retry, cancel, busy: items.some((i) => i.status === 'uploading' || i.status === 'queued') };
}

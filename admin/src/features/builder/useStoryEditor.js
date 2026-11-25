import { useCallback, useEffect, useRef, useState } from 'react';
import { produce } from 'immer';
import { createEmptyStory, createIntro, relinkImages } from '@shared/engine/defaults.js';
import { storiesApi, errorMessage } from '../../lib/api.js';
import { loadPrefs } from '../../lib/utils.js';

const CONTENT_KEYS = ['title', 'description', 'category', 'coverImage', 'status', 'intro', 'scenes'];
const META_KEYS = ['id', 'isPublished', 'publishedAt', 'hasUnpublishedChanges', 'createdAt', 'updatedAt', 'sceneCount'];

export const contentOf = (story) => Object.fromEntries(CONTENT_KEYS.map((k) => [k, story[k]]));

/**
 * Owns the story being edited: immutable updates (immer), dirty tracking,
 * a serialized save queue (manual saves and autosaves never overlap) and autosave.
 */
export function useStoryEditor(id) {
  const [story, setStory] = useState(() => (id ? null : createEmptyStory()));
  const [loadError, setLoadError] = useState('');
  const [saveState, setSaveState] = useState({ saving: false, error: '', lastSavedAt: null });
  const [version, setVersion] = useState(0);
  const savedVersion = useRef(0);
  const queue = useRef(Promise.resolve());
  const storyRef = useRef(story);
  storyRef.current = story;
  const versionRef = useRef(version);
  versionRef.current = version;
  const prefs = useRef(loadPrefs());

  const load = useCallback(() => {
    if (!id) return;
    setLoadError('');
    storiesApi
      .get(id)
      .then((s) => {
        setStory({ ...s, intro: s.intro || createIntro(), scenes: s.scenes || [] });
        savedVersion.current = versionRef.current;
      })
      .catch((e) => setLoadError(errorMessage(e)));
  }, [id]);
  useEffect(load, [load]);

  /** Apply an immer recipe to the story and mark it dirty. */
  const update = useCallback((recipe) => {
    // Recipes only mutate the draft; ignore any return value (e.g. from `list.push`).
    setStory((prev) => produce(prev, (draft) => { recipe(draft); }));
    setVersion((v) => v + 1);
  }, []);

  const dirty = version !== savedVersion.current;

  // The server files images into the story's folder on save; follow the new links
  // (without marking the story as changed).
  const mergeMeta = (saved) => {
    setStory((prev) => {
      const next = produce(prev, (d) => {
        META_KEYS.forEach((k) => { d[k] = saved[k]; });
        d.status = saved.status;
      });
      return relinkImages(next, saved.imageChanges);
    });
  };

  /** Saves the current content. Resolves to the saved story (or throws). */
  const save = useCallback(() => {
    const run = async () => {
      const current = storyRef.current;
      if (!current?.id) throw new Error('Story has not been created yet.');
      const v = versionRef.current;
      setSaveState((s) => ({ ...s, saving: true, error: '' }));
      try {
        const saved = await storiesApi.update(current.id, contentOf(current));
        if (savedVersion.current < v) savedVersion.current = v;
        mergeMeta(saved);
        setSaveState({ saving: false, error: '', lastSavedAt: new Date() });
        return saved;
      } catch (e) {
        setSaveState((s) => ({ ...s, saving: false, error: errorMessage(e) }));
        throw e;
      }
    };
    const p = queue.current.then(run, run);
    queue.current = p.catch(() => {});
    return p;
  }, []);

  /** First save of a new story (POST). */
  const create = useCallback(async () => {
    setSaveState((s) => ({ ...s, saving: true, error: '' }));
    try {
      const created = await storiesApi.create(contentOf(storyRef.current));
      savedVersion.current = versionRef.current;
      const { imageChanges, ...meta } = created;
      setStory((prev) => relinkImages({ ...prev, ...meta, scenes: prev.scenes, intro: prev.intro, coverImage: prev.coverImage }, imageChanges));
      setSaveState({ saving: false, error: '', lastSavedAt: new Date() });
      return created;
    } catch (e) {
      setSaveState((s) => ({ ...s, saving: false, error: errorMessage(e) }));
      throw e;
    }
  }, []);

  const replaceFromServer = useCallback((saved) => {
    setStory((prev) => ({ ...prev, ...saved }));
  }, []);

  // Debounced autosave.
  useEffect(() => {
    if (!dirty || !story?.id || !prefs.current.autosave || !story.title?.trim()) return undefined;
    const t = setTimeout(() => save().catch(() => {}), prefs.current.autosaveDelay * 1000);
    return () => clearTimeout(t);
  }, [version, dirty, story?.id, story?.title, save]);

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty) return undefined;
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  return { story, update, save, create, dirty, saveState, loadError, reload: load, replaceFromServer };
}

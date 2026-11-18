import { useCallback, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { AlertTriangle, ArrowLeft, ArrowRight, Check, CloudOff, Eye, Loader2, Rocket, Save } from 'lucide-react';
import { validateForPublish } from '@shared/engine/validate.js';
import { Button } from '../../components/ui/Button.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { ErrorState, Spinner, StatusBadge } from '../../components/ui/Misc.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { storiesApi, errorDetails, errorMessage } from '../../lib/api.js';
import { cx, loadPrefs } from '../../lib/utils.js';
import { useStoryEditor } from './useStoryEditor.js';
import StepInfo from './StepInfo.jsx';
import StepIntro from './StepIntro.jsx';
import StepScenes from './StepScenes.jsx';

const STEPS = [
  { n: 1, label: 'Information' },
  { n: 2, label: 'Introduction' },
  { n: 3, label: 'Scroll experience' },
];

function SaveIndicator({ dirty, saveState }) {
  if (saveState.saving) return <span className="flex items-center gap-1.5 text-xs text-ink-300"><Loader2 className="size-3.5 animate-spin" />Saving…</span>;
  if (saveState.error) return <span className="flex items-center gap-1.5 text-xs text-rose-300" title={saveState.error}><CloudOff className="size-3.5" />Not saved</span>;
  if (dirty) return <span className="text-xs text-amber-300">Unsaved changes</span>;
  if (saveState.lastSavedAt) return <span className="flex items-center gap-1.5 text-xs text-ink-400"><Check className="size-3.5 text-emerald-400" />Saved {saveState.lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>;
  return null;
}

export default function StoryBuilderPage() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { isAdmin } = useAuth();
  const { story, update, save, create, dirty, saveState, loadError, reload, replaceFromServer } = useStoryEditor(id);

  const step = id ? Math.min(3, Math.max(1, Number(params.get('step')) || 1)) : 1;
  const [aspect, setAspect] = useState(() => loadPrefs().stageAspect);
  const [infoErrors, setInfoErrors] = useState({});
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(null); // 'draft' | 'publish' | 'preview' | 'continue'
  const [publishErrors, setPublishErrors] = useState(null);

  const issues = useMemo(() => (story ? validateForPublish(story) : []), [story]);

  const goStep = (n) => setParams({ step: String(n) }, { replace: true });

  const validateInfo = () => {
    const e = {};
    if (!story.title.trim()) e.title = 'Story title is required.';
    if (!story.scenes.length) e.scenes = 'Upload at least one story image.';
    setInfoErrors(e);
    return !Object.keys(e).length;
  };

  /** Make sure the story exists on the server and the latest edits are saved. */
  const persist = useCallback(async () => {
    if (!story.id) {
      const created = await create();
      return created;
    }
    if (dirty || saveState.error) return save();
    return story;
  }, [story, dirty, saveState.error, create, save]);

  const run = async (kind, fn) => {
    setBusy(kind);
    try {
      await fn();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const onContinue = () => run('continue', async () => {
    if (!validateInfo()) {
      toast.error('Fix the highlighted fields to continue.');
      return;
    }
    const saved = await persist();
    if (!id) navigate(`/stories/${saved.id}/edit?step=2`, { replace: true });
    else goStep(2);
  });

  const onSaveDraft = () => run('draft', async () => {
    if (!story.title.trim()) {
      setInfoErrors({ title: 'Story title is required.' });
      goStep(1);
      throw new Error('Add a story title before saving.');
    }
    const saved = await persist();
    toast.success(story.isPublished ? 'Draft saved. The live version is unchanged until you update the story.' : 'Draft saved.');
    if (!id) navigate(`/stories/${saved.id}/edit?step=1`, { replace: true });
  });

  const onPreview = () => run('preview', async () => {
    if (!story.title.trim() || !story.scenes.length) {
      validateInfo();
      goStep(1);
      throw new Error('Add a title and at least one image to preview.');
    }
    const saved = await persist();
    navigate(`/stories/${saved.id}/preview`, { state: { from: `/stories/${saved.id}/edit?step=${step}` } });
  });

  const onPublish = () => run('publish', async () => {
    if (issues.length) {
      setPublishErrors(issues);
      return;
    }
    const saved = await persist();
    try {
      const published = await storiesApi.publish(saved.id);
      replaceFromServer({ status: published.status, isPublished: true, publishedAt: published.publishedAt, hasUnpublishedChanges: false });
      toast.success(story.isPublished ? 'Story updated in the desktop app.' : 'Published! The story is now live in the desktop app.');
    } catch (e) {
      const details = errorDetails(e);
      if (details.length) setPublishErrors(details);
      else throw e;
    }
  });

  const onBack = () => run('back', async () => {
    if (story?.id && dirty) await save();
    navigate('/stories');
  });

  if (loadError) return <div className="p-10"><ErrorState message={loadError} onRetry={reload} /></div>;
  if (!story) return <Spinner className="h-full" label="Loading story…" />;

  const canOpenStep = (n) => n === 1 || !!story.id;

  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-ink-700/70 bg-ink-900 px-3 py-2 sm:px-4 md:h-16 md:flex-nowrap md:gap-4 md:py-0">
        <Button size="icon" variant="ghost" onClick={onBack} aria-label="Back to stories" loading={busy === 'back'}><ArrowLeft className="size-5" /></Button>
        <div className="min-w-0 flex-1 md:w-56 md:flex-none md:shrink">
          <div className="truncate text-[15px] font-semibold text-white">{story.title || 'Untitled story'}</div>
          <div className="mt-0.5 flex items-center gap-2">
            <StatusBadge status={story.status} className="px-2 py-0 text-[11px]" />
            {story.hasUnpublishedChanges && <span className="text-[11px] text-amber-300">Live version differs</span>}
          </div>
        </div>

        <nav className="order-last flex w-full items-center justify-center gap-1 md:order-none md:mx-auto md:w-auto" aria-label="Builder steps">
          {STEPS.map((s, i) => (
            <div key={s.n} className="flex items-center">
              {i > 0 && <div className="mx-1 h-px w-6 bg-ink-700" />}
              <button
                type="button"
                disabled={!canOpenStep(s.n)}
                onClick={() => goStep(s.n)}
                aria-current={step === s.n ? 'step' : undefined}
                title={!canOpenStep(s.n) ? 'Complete story information first' : undefined}
                className={cx(
                  'flex h-9 items-center gap-2 rounded-full px-3 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                  step === s.n ? 'bg-ink-750 text-white' : 'text-ink-300 hover:text-white',
                )}
              >
                <span className={cx('grid size-5 place-items-center rounded-full text-[11px] font-bold', step === s.n ? 'bg-accent-500 text-white' : step > s.n ? 'bg-emerald-500/20 text-emerald-300' : 'bg-ink-700 text-ink-300')}>
                  {step > s.n ? <Check className="size-3" /> : s.n}
                </span>
                <span className="hidden sm:inline md:hidden xl:inline">{s.label}</span>
              </button>
            </div>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <div className="hidden w-32 justify-end lg:flex"><SaveIndicator dirty={dirty} saveState={saveState} /></div>
          <Button size="md" icon={Save} onClick={onSaveDraft} loading={busy === 'draft'} disabled={!!busy || uploading} title="Save draft" aria-label="Save draft"><span className="hidden sm:inline">Save draft</span></Button>
          <Button size="md" icon={Eye} onClick={onPreview} loading={busy === 'preview'} disabled={!!busy || uploading} title="Preview" aria-label="Preview"><span className="hidden sm:inline">Preview</span></Button>
          <Button
            size="md"
            variant="primary"
            icon={Rocket}
            aria-label={story.isPublished ? 'Update story' : 'Publish story'}
            onClick={onPublish}
            loading={busy === 'publish'}
            disabled={!!busy || uploading || !story.id || !isAdmin}
            title={!isAdmin ? 'Only administrators can publish' : !story.id ? 'Save the story first' : issues.length ? `${issues.length} problem(s) to fix before publishing` : undefined}
          >
            <span className="hidden sm:inline">{story.isPublished ? 'Update story' : 'Publish story'}</span>
            {issues.length > 0 && story.id && <span className="ml-1 rounded-full bg-white/20 px-1.5 text-[11px] tabular-nums">{issues.length}</span>}
          </Button>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-hidden">
        {step === 1 && (
          <div className="flex h-full flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto">
              <StepInfo story={story} update={update} errors={infoErrors} onBusyChange={setUploading} />
            </div>
            <div className="flex shrink-0 items-center justify-end gap-3 border-t border-ink-700/70 bg-ink-900 px-4 py-3 sm:px-6">
              {uploading && <span className="text-xs text-ink-400">Waiting for uploads to finish…</span>}
              <Button variant="primary" size="lg" onClick={onContinue} loading={busy === 'continue'} disabled={!!busy || uploading}>
                Continue <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
        {step === 2 && <StepIntro story={story} update={update} aspect={aspect} setAspect={setAspect} />}
        {step === 3 && <StepScenes story={story} update={update} aspect={aspect} setAspect={setAspect} issues={issues} />}
      </main>

      <Modal
        open={!!publishErrors}
        onClose={() => setPublishErrors(null)}
        size="lg"
        title="Fix these before publishing"
        description="Incomplete stories can't be published. Your draft is safe."
        footer={<Button variant="primary" onClick={() => setPublishErrors(null)}>Got it</Button>}
      >
        <ul className="max-h-80 space-y-2 overflow-y-auto">
          {publishErrors?.map((e, i) => (
            <li key={`${e.path}-${i}`} className="flex items-start gap-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 text-sm text-ink-100">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-400" />
              {e.message}
            </li>
          ))}
        </ul>
      </Modal>
    </div>
  );
}

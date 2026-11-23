import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { StoryPlayer, resolveShareUrl } from '@shared/react/index.js';
import { storiesApi, errorMessage } from '../lib/api.js';
import { ErrorState, Spinner } from '../components/ui/Misc.jsx';
import { useFooterSettings } from '../hooks/useFooterSettings.js';

/**
 * Full-screen preview of the working copy, rendered by the same StoryPlayer the
 * desktop app uses.
 */
export default function StoryPreviewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  // Return to wherever the preview was opened from (Stories list or the editor).
  // Opened directly (bookmark/reload without history state) → the Stories list.
  const from = typeof location.state?.from === 'string' ? location.state.from : '/stories';
  const backLabel = from.includes('/edit') ? 'Back to editor' : 'Back to stories';
  const [story, setStory] = useState(null);
  const footer = useFooterSettings();
  const [error, setError] = useState('');

  useEffect(() => {
    storiesApi.get(id).then(setStory).catch((e) => setError(errorMessage(e)));
  }, [id]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && navigate(from);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [from, navigate]);

  const back = () => navigate(from);

  if (error) return <div className="p-10"><ErrorState message={error} onRetry={() => window.location.reload()} /></div>;
  if (!story) return <Spinner className="h-full bg-black" label="Loading preview…" />;

  return (
    <StoryPlayer story={story} onExit={back} exitLabel={backLabel} shareUrl={resolveShareUrl(import.meta.env.VITE_SHARE_URL, story.id)} footer={footer}>
      <div className="absolute top-5 left-5 z-30 flex items-center gap-3">
        <button
          type="button"
          onClick={back}
          className="flex h-10 items-center gap-2 rounded-full border border-white/15 bg-black/45 px-4 text-sm font-medium text-white backdrop-blur-md transition hover:bg-black/70"
        >
          <ArrowLeft className="size-4" /> {backLabel}
        </button>
        <span className="rounded-full bg-amber-400/90 px-3 py-1 text-[11px] font-semibold tracking-wider text-black uppercase">Preview</span>
      </div>
    </StoryPlayer>
  );
}

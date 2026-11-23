import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, Maximize2, Minimize2 } from 'lucide-react';
import { StoryPlayer, resolveShareUrl } from '@shared/react/index.js';
import { api, getConfig } from '../api.js';

const IDLE_MS = 2200;

/** Full-screen story experience. Controls fade away while the viewer is reading. */
export default function ViewerPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [story, setStory] = useState(null);
  const [error, setError] = useState(null);
  const [chrome, setChrome] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [shareTemplate, setShareTemplate] = useState('');
  useEffect(() => { getConfig().then((c) => setShareTemplate(c.shareUrl)); }, []);
  const [footer, setFooter] = useState(null);
  useEffect(() => { api.getFooter().then(setFooter); }, []);
  const idle = useRef(0);

  useEffect(() => {
    const ctrl = new AbortController();
    setStory(null);
    setError(null);
    api.getStory(id, { signal: ctrl.signal }).then(setStory).catch((e) => !ctrl.signal.aborted && setError(e));
    return () => ctrl.abort();
  }, [id]);

  // Go full screen for the story; restore the window when leaving.
  useEffect(() => {
    const bridge = window.storyframe;
    if (!bridge) return undefined;
    bridge.setFullScreen(true).then(setFullscreen);
    const off = bridge.onFullScreenChange(setFullscreen);
    return () => {
      off();
      bridge.setFullScreen(false);
    };
  }, []);

  const back = useCallback(() => navigate('/'), [navigate]);

  // Auto-hide the controls (and cursor) when idle.
  useEffect(() => {
    const wake = () => {
      setChrome(true);
      clearTimeout(idle.current);
      idle.current = setTimeout(() => setChrome(false), IDLE_MS);
    };
    wake();
    window.addEventListener('mousemove', wake);
    window.addEventListener('keydown', wake);
    return () => {
      clearTimeout(idle.current);
      window.removeEventListener('mousemove', wake);
      window.removeEventListener('keydown', wake);
    };
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (fullscreen) window.storyframe?.setFullScreen(false);
        else back();
      } else if (e.key === 'F11') {
        e.preventDefault();
        window.storyframe?.setFullScreen(!fullscreen);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen, back]);

  if (error) {
    return (
      <div className="grid min-h-screen place-items-center bg-black px-6 text-center">
        <div className="anim-rise">
          <h1 className="text-xl font-semibold text-white">{error.status === 404 ? 'This story is no longer available' : 'The story could not be opened'}</h1>
          <p className="mt-2 text-sm text-ink-400">{error.status === 404 ? 'It may have been unpublished.' : error.message}</p>
          <button type="button" onClick={back} className="mt-8 h-11 rounded-full bg-white px-6 text-sm font-semibold text-black hover:bg-white/90">Back to stories</button>
        </div>
      </div>
    );
  }

  if (!story) {
    return (
      <div className="sp-loading" style={{ position: 'fixed' }}>
        <div className="sp-spinner" />
      </div>
    );
  }

  return (
    <div style={{ cursor: chrome ? 'auto' : 'none' }}>
      <StoryPlayer story={story} onExit={back} exitLabel="Back to stories" shareUrl={resolveShareUrl(shareTemplate, story.id)} footer={footer}>
        <div className={`absolute top-6 right-6 left-6 z-30 flex items-center justify-between transition-opacity duration-500 ${chrome ? 'opacity-100' : 'pointer-events-none opacity-0'}`}>
          <button
            type="button"
            onClick={back}
            className="flex h-11 items-center gap-2 rounded-full border border-white/15 bg-black/40 px-5 text-sm font-medium text-white backdrop-blur-md transition hover:bg-black/70"
          >
            <ArrowLeft className="size-4" /> Stories
          </button>
          {window.storyframe && (
            <button
              type="button"
              onClick={() => window.storyframe.setFullScreen(!fullscreen)}
              className="grid size-11 place-items-center rounded-full border border-white/15 bg-black/40 text-white backdrop-blur-md transition hover:bg-black/70"
              aria-label={fullscreen ? 'Exit full screen' : 'Full screen'}
              title={fullscreen ? 'Exit full screen (Esc)' : 'Full screen (F11)'}
            >
              {fullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            </button>
          )}
        </div>
      </StoryPlayer>
    </div>
  );
}

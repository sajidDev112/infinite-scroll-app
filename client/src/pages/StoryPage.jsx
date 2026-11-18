import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, Maximize2, Minimize2 } from 'lucide-react';
import { BRAND_NAME, StoryPlayer, resolveShareUrl } from '@shared/react/index.js';
import { api, SHARE_URL } from '../api.js';

const IDLE_MS = 2200;
const canFullscreen = typeof document !== 'undefined' && !!document.documentElement.requestFullscreen;

/** Page 2: the scroll story experience (same player as the admin preview and desktop app). */
export default function StoryPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [story, setStory] = useState(null);
  const [error, setError] = useState(null);
  const [chrome, setChrome] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const idle = useRef(0);

  useEffect(() => {
    const ctrl = new AbortController();
    setStory(null);
    setError(null);
    api.getStory(id, { signal: ctrl.signal }).then(setStory).catch((e) => !ctrl.signal.aborted && setError(e));
    return () => ctrl.abort();
  }, [id]);

  useEffect(() => {
    if (story) document.title = `${story.title} · ${BRAND_NAME}`;
  }, [story]);

  const back = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    navigate('/stories');
  }, [navigate]);

  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen().catch(() => {});
  };

  // Fade the controls (and cursor) away while the visitor is reading.
  useEffect(() => {
    const wake = () => {
      setChrome(true);
      clearTimeout(idle.current);
      idle.current = setTimeout(() => setChrome(false), IDLE_MS);
    };
    wake();
    const events = ['mousemove', 'keydown', 'touchstart'];
    events.forEach((ev) => window.addEventListener(ev, wake, { passive: true }));
    return () => {
      clearTimeout(idle.current);
      events.forEach((ev) => window.removeEventListener(ev, wake));
    };
  }, []);

  // Esc leaves the story (the browser itself handles Esc while in full screen).
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !document.fullscreenElement) back(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [back]);

  if (error) {
    return (
      <div className="grid min-h-screen place-items-center bg-black px-6 text-center">
        <div className="anim-rise">
          <h1 className="text-xl font-semibold text-white">{error.status === 404 ? 'This story is no longer available' : 'The story could not be opened'}</h1>
          <p className="mt-2 text-sm text-ink-400">{error.status === 404 ? 'It may have been taken down.' : error.message}</p>
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

  const shareUrl = resolveShareUrl(SHARE_URL || `${window.location.origin}${import.meta.env.BASE_URL}stories/{id}`, story.id);

  return (
    <div style={{ cursor: chrome ? 'auto' : 'none' }}>
      <StoryPlayer story={story} onExit={back} exitLabel="Back to stories" shareUrl={shareUrl}>
        <div className={`absolute top-4 right-4 left-4 z-30 flex items-center justify-between transition-opacity duration-500 sm:top-6 sm:right-6 sm:left-6 ${chrome ? 'opacity-100' : 'pointer-events-none opacity-0'}`}>
          <button
            type="button"
            onClick={back}
            className="flex h-10 items-center gap-2 rounded-full border border-white/15 bg-black/40 px-4 text-sm font-medium text-white backdrop-blur-md transition hover:bg-black/70 sm:h-11 sm:px-5"
          >
            <ArrowLeft className="size-4" /> Stories
          </button>
          {canFullscreen && (
            <button
              type="button"
              onClick={toggleFullscreen}
              className="grid size-10 place-items-center rounded-full border border-white/15 bg-black/40 text-white backdrop-blur-md transition hover:bg-black/70 sm:size-11"
              aria-label={fullscreen ? 'Exit full screen' : 'Full screen'}
              title={fullscreen ? 'Exit full screen' : 'Full screen'}
            >
              {fullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            </button>
          )}
        </div>
      </StoryPlayer>
    </div>
  );
}

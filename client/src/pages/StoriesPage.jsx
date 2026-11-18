import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowRight, BookOpen, WifiOff } from 'lucide-react';
import { BRAND_NAME } from '@shared/react/index.js';
import { api } from '../api.js';

const cx = (...c) => c.filter(Boolean).join(' ');

function StoryCard({ story, index, onOpen }) {
  const src = story.coverImage?.thumbUrl || story.coverImage?.url;
  return (
    <button
      type="button"
      onClick={() => onOpen(story)}
      onMouseEnter={() => api.prefetch(story.id)}
      onFocus={() => api.prefetch(story.id)}
      className="group anim-rise relative block w-full overflow-hidden rounded-2xl bg-ink-800 text-left ring-1 ring-white/5 transition duration-500 hover:-translate-y-1 hover:ring-white/20 hover:shadow-[0_30px_60px_-20px_rgba(0,0,0,0.9)]"
      style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        {src ? (
          <img src={src} alt="" loading="lazy" decoding="async" className="size-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-[1.06]" />
        ) : (
          <div className="grid size-full place-items-center text-ink-500"><BookOpen className="size-8" /></div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
        {story.category && (
          <span className="absolute top-4 left-4 rounded-full bg-black/45 px-3 py-1 text-[11px] font-medium tracking-wider text-white/90 uppercase backdrop-blur-md">{story.category}</span>
        )}
        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
          <h3 className="font-display text-xl leading-tight font-medium text-white sm:text-2xl">{story.title}</h3>
          {story.description && <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-white/70">{story.description}</p>}
          <div className="mt-4 flex items-center gap-2 text-xs font-medium text-white/60">
            <span>{story.sceneCount} scene{story.sceneCount === 1 ? '' : 's'}</span>
            <span className="ml-auto flex items-center gap-1.5 text-white transition duration-300 group-hover:translate-x-0.5 sm:opacity-0 sm:group-hover:opacity-100">
              Explore <ArrowRight className="size-3.5" />
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

/** Page 1: every active story as a card. */
export default function StoriesPage() {
  const navigate = useNavigate();
  const [data, setData] = useState(() => api.cachedList());
  const [status, setStatus] = useState(data ? 'ready' : 'loading');
  const [error, setError] = useState('');
  const [category, setCategory] = useState('');

  useEffect(() => { document.title = `Stories · ${BRAND_NAME}`; }, []);

  const load = useCallback(async (force = false) => {
    setError('');
    try {
      const res = await api.listStories({ force });
      if (force) api.clearStoryCache();
      setData(res);
      setStatus('ready');
    } catch (e) {
      setError(e.message);
      setStatus((s) => (s === 'ready' ? 'ready' : 'error'));
    }
  }, []);

  // Always fetch fresh on open so newly activated stories appear.
  useEffect(() => { load(true); }, [load]);

  // Always open at the top so the logo and category filters are the first thing seen,
  // including when coming back from a story.
  useLayoutEffect(() => {
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
  }, [status]);

  const items = data?.items || [];
  const grid = useMemo(() => items.filter((s) => !category || s.category === category), [items, category]);

  const open = (s) => navigate(`/stories/${s.id}`);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-white/5 bg-ink-950/85 backdrop-blur-md">
        <div className="mx-auto flex h-20 max-w-[1600px] items-center gap-4 px-5 sm:h-24 sm:px-10">
          <Link to="/stories" className="flex shrink-0 items-center" aria-label={`${BRAND_NAME} — all stories`}>
            <img src={`${import.meta.env.BASE_URL}brand-logo.png`} alt={BRAND_NAME} className="h-11 w-auto sm:h-14" />
          </Link>
        </div>
      </header>

      {status === 'loading' && (
        <div className="mx-auto max-w-[1600px] px-5 pt-8 sm:px-10">
          <div className="mt-2 grid gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => <div key={i} className="aspect-[4/3] animate-pulse rounded-2xl bg-ink-800" />)}
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="grid min-h-[70vh] place-items-center px-6 text-center">
          <div className="anim-rise max-w-md">
            <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-ink-800 text-ink-300"><WifiOff className="size-6" /></div>
            <h2 className="mt-6 text-xl font-semibold text-white">Stories couldn't be loaded</h2>
            <p className="mt-2 text-sm text-ink-400">{error}</p>
            <button type="button" onClick={() => load(true)} className="mt-8 h-11 rounded-full bg-white px-6 text-sm font-semibold text-black hover:bg-white/90">Try again</button>
          </div>
        </div>
      )}

      {status === 'ready' && (
        <>
          <main className="mx-auto max-w-[1600px] px-5 pt-8 pb-20 sm:px-10 sm:pt-10">
            {error && (
              <div className="mb-6 rounded-xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">Couldn't refresh: {error}</div>
            )}
            {data.categories?.length > 0 && (
              <div className="no-scrollbar mb-8 flex gap-2 overflow-x-auto" role="group" aria-label="Filter by category">
                {['', ...data.categories].map((c) => (
                  <button
                    key={c || 'all'}
                    type="button"
                    onClick={() => setCategory(c)}
                    aria-pressed={category === c}
                    className={cx('h-9 shrink-0 rounded-full px-4 text-sm font-medium transition', category === c ? 'bg-white text-black' : 'border border-white/15 text-white/75 hover:border-white/40 hover:text-white')}
                  >
                    {c || 'All stories'}
                  </button>
                ))}
              </div>
            )}

            {items.length === 0 ? (
              <div className="anim-rise grid place-items-center py-24 text-center">
                <div className="grid size-14 place-items-center rounded-2xl bg-ink-800 text-ink-300"><BookOpen className="size-6" /></div>
                <h2 className="mt-6 text-xl font-semibold text-white">No stories yet</h2>
                <p className="mt-2 max-w-sm text-sm text-ink-400">New stories will appear here soon.</p>
              </div>
            ) : grid.length === 0 ? (
              <div className="py-24 text-center">
                <p className="text-white">No stories in this category yet.</p>
                <button type="button" onClick={() => setCategory('')} className="mt-3 text-sm text-accent-400 hover:underline">Show all stories</button>
              </div>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 sm:gap-6 xl:grid-cols-3 2xl:grid-cols-4">
                {grid.map((s, i) => <StoryCard key={s.id} story={s} index={i} onOpen={open} />)}
              </div>
            )}
          </main>

          <footer className="border-t border-white/10">
            <div className="mx-auto flex max-w-[1600px] flex-col items-center gap-3 px-5 py-10 text-center sm:flex-row sm:justify-between sm:px-10 sm:text-left">
              <img src={`${import.meta.env.BASE_URL}brand-logo.png`} alt="" className="h-10 w-auto opacity-80" />
              <p className="text-xs text-white/45">© {new Date().getFullYear()} {BRAND_NAME}</p>
            </div>
          </footer>
        </>
      )}
    </div>
  );
}

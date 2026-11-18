import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowRight, BookOpen, RefreshCw, Search, WifiOff, X } from 'lucide-react';
import { api, getConfig } from '../api.js';
import logo from '../logo.svg';

const cx = (...c) => c.filter(Boolean).join(' ');
const SCROLL_KEY = 'sf_home_scroll';

function StoryCard({ story, index, onOpen }) {
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
        {story.coverImage?.thumbUrl || story.coverImage?.url ? (
          <img
            src={story.coverImage.thumbUrl || story.coverImage.url}
            alt=""
            loading="lazy"
            decoding="async"
            className="size-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-[1.06]"
          />
        ) : (
          <div className="grid size-full place-items-center text-ink-500"><BookOpen className="size-8" /></div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
        {story.category && (
          <span className="absolute top-4 left-4 rounded-full bg-black/45 px-3 py-1 text-[11px] font-medium tracking-wider text-white/90 uppercase backdrop-blur-md">{story.category}</span>
        )}
        <div className="absolute inset-x-0 bottom-0 p-6">
          <h3 className="font-display text-2xl leading-tight font-medium text-white">{story.title}</h3>
          {story.description && <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-white/70">{story.description}</p>}
          <div className="mt-4 flex items-center gap-2 text-xs font-medium text-white/60">
            <span>{story.sceneCount} scene{story.sceneCount === 1 ? '' : 's'}</span>
            <span className="ml-auto flex items-center gap-1.5 text-white opacity-0 transition duration-300 group-hover:translate-x-0.5 group-hover:opacity-100">
              Begin <ArrowRight className="size-3.5" />
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

function Hero({ story, onOpen }) {
  const src = story.coverImage?.url || story.coverImage?.thumbUrl;
  return (
    <section className="anim-fade relative h-[64vh] min-h-[420px] overflow-hidden">
      {src && <img src={src} alt="" className="absolute inset-0 size-full scale-105 object-cover" decoding="async" />}
      <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/40 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-transparent to-black/30" />
      <div className="relative mx-auto flex h-full max-w-[1600px] flex-col justify-end px-10 pb-16">
        <p className="anim-rise text-xs font-semibold tracking-[0.3em] text-white/60 uppercase">Featured story</p>
        <h1 className="anim-rise mt-4 max-w-3xl font-display text-5xl leading-[1.05] font-medium text-white xl:text-6xl" style={{ animationDelay: '80ms' }}>{story.title}</h1>
        {story.description && <p className="anim-rise mt-5 max-w-xl text-base leading-relaxed text-white/75" style={{ animationDelay: '160ms' }}>{story.description}</p>}
        <div className="anim-rise mt-8" style={{ animationDelay: '240ms' }}>
          <button
            type="button"
            onClick={() => onOpen(story)}
            onMouseEnter={() => api.prefetch(story.id)}
            className="inline-flex h-12 items-center gap-2.5 rounded-full bg-white px-7 text-sm font-semibold text-black transition hover:bg-white/90 active:scale-[0.98]"
          >
            Begin story <ArrowRight className="size-4" />
          </button>
        </div>
      </div>
    </section>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const [data, setData] = useState(() => api.cachedList());
  const [status, setStatus] = useState(data ? 'ready' : 'loading');
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [version, setVersion] = useState('');

  useEffect(() => { getConfig().then((c) => setVersion(c.version)); }, []);

  const load = useCallback(async (force = false) => {
    if (force) setRefreshing(true);
    setError('');
    try {
      const res = await api.listStories({ force });
      if (force) api.clearStoryCache();
      setData(res);
      setStatus('ready');
    } catch (e) {
      setError(e.message);
      setStatus((s) => (s === 'ready' ? 'ready' : 'error'));
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(false); }, [load]);

  // Restore the list scroll position when coming back from a story.
  useLayoutEffect(() => {
    if (status !== 'ready') return undefined;
    const y = Number(sessionStorage.getItem(SCROLL_KEY) || 0);
    if (y) window.scrollTo(0, y);
    return () => sessionStorage.setItem(SCROLL_KEY, String(window.scrollY));
  }, [status]);

  const items = data?.items || [];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((s) => (!category || s.category === category)
      && (!q || s.title.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q)));
  }, [items, query, category]);
  const showHero = !query && !category && filtered.length > 0;
  const grid = showHero ? filtered.slice(1) : filtered;

  const open = (s) => navigate(`/story/${s.id}`);

  return (
    <div className="min-h-screen">
      <header className="fixed inset-x-0 top-0 z-30 bg-gradient-to-b from-black/80 to-transparent">
        <div className="mx-auto flex h-20 max-w-[1600px] items-center gap-4 px-10">
          <img src={logo} alt="" className="size-9" />
          <span className="text-lg font-semibold tracking-tight text-white">Storyframe</span>
          {version && <span className="rounded-full border border-white/15 px-2 py-0.5 text-[11px] text-white/60 tabular-nums">v{version}</span>}
          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-white/50" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search stories"
                aria-label="Search stories"
                className="h-10 w-64 rounded-full border border-white/15 bg-black/40 pr-9 pl-10 text-sm text-white placeholder:text-white/45 backdrop-blur-md transition focus:w-80 focus:border-white/40 focus:outline-none"
              />
              {query && (
                <button type="button" onClick={() => setQuery('')} className="absolute top-1/2 right-3 -translate-y-1/2 text-white/50 hover:text-white" aria-label="Clear search">
                  <X className="size-4" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => load(true)}
              disabled={refreshing}
              className="grid size-10 place-items-center rounded-full border border-white/15 bg-black/40 text-white/80 backdrop-blur-md transition hover:border-white/40 hover:text-white disabled:opacity-60"
              aria-label="Refresh stories"
              title="Refresh"
            >
              <RefreshCw className={cx('size-4', refreshing && 'animate-spin')} />
            </button>
          </div>
        </div>
      </header>

      {status === 'loading' && (
        <div className="mx-auto max-w-[1600px] px-10 pt-28">
          <div className="h-[52vh] animate-pulse rounded-3xl bg-ink-800" />
          <div className="mt-10 grid gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => <div key={i} className="aspect-[4/3] animate-pulse rounded-2xl bg-ink-800" />)}
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="grid min-h-screen place-items-center px-6 text-center">
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
          {showHero ? <Hero story={filtered[0]} onOpen={open} /> : <div className="h-28" />}

          <main className="mx-auto max-w-[1600px] px-10 pb-20">
            {error && (
              <div className="mb-6 rounded-xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">Couldn't refresh: {error}</div>
            )}
            {data.categories?.length > 0 && (
              <div className={cx('mb-8 flex flex-wrap gap-2', showHero && '-mt-2')} role="group" aria-label="Filter by category">
                {['', ...data.categories].map((c) => (
                  <button
                    key={c || 'all'}
                    type="button"
                    onClick={() => setCategory(c)}
                    aria-pressed={category === c}
                    className={cx('h-9 rounded-full px-4 text-sm font-medium transition', category === c ? 'bg-white text-black' : 'border border-white/15 text-white/75 hover:border-white/40 hover:text-white')}
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
                <p className="mt-2 max-w-sm text-sm text-ink-400">Published stories appear here. Check back soon, or refresh.</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-24 text-center">
                <p className="text-white">No stories match your search.</p>
                <button type="button" onClick={() => { setQuery(''); setCategory(''); }} className="mt-3 text-sm text-accent-400 hover:underline">Clear filters</button>
              </div>
            ) : grid.length > 0 && (
              <>
                {showHero && <h2 className="mb-6 text-sm font-semibold tracking-[0.25em] text-white/50 uppercase">More stories</h2>}
                <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {grid.map((s, i) => <StoryCard key={s.id} story={s} index={i} onOpen={open} />)}
                </div>
              </>
            )}
          </main>
        </>
      )}
    </div>
  );
}

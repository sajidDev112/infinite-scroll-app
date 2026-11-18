import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import {
  BookOpen, Copy, Eye, Images, MoreHorizontal, Pause, Pencil, Play, Plus, Search, Trash2,
} from 'lucide-react';
import { storiesApi, errorMessage } from '../lib/api.js';
import { Button } from '../components/ui/Button.jsx';
import { Select, Segmented } from '../components/ui/Fields.jsx';
import { EmptyState, ErrorState, PageHeader, Skeleton, StatusBadge } from '../components/ui/Misc.jsx';
import { ConfirmDialog } from '../components/ui/Modal.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { cx, formatDate, timeAgo } from '../lib/utils.js';

const LIMIT = 12;

function CardMenu({ story, isAdmin, onAction }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const item = (label, Icon, action, opts = {}) => (
    <button
      type="button"
      role="menuitem"
      disabled={opts.disabled}
      title={opts.title}
      onClick={() => {
        setOpen(false);
        onAction(action, story);
      }}
      className={cx(
        'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-40',
        opts.danger ? 'text-rose-300 hover:bg-rose-500/10' : 'text-ink-100 hover:bg-ink-700',
      )}
    >
      <Icon className="size-4" />
      {label}
    </button>
  );

  return (
    <div ref={ref} className="relative">
      <Button size="icon-sm" variant="ghost" onClick={() => setOpen((o) => !o)} aria-label="Story actions" aria-expanded={open}>
        <MoreHorizontal className="size-4" />
      </Button>
      {open && (
        <div role="menu" className="anim-pop absolute right-0 bottom-10 z-20 w-52 rounded-xl border border-ink-700 bg-ink-800 p-1.5 shadow-pop">
          {item('Edit', Pencil, 'edit')}
          {item('Preview', Eye, 'preview')}
          {item('Duplicate', Copy, 'duplicate')}
          {story.status === 'active'
            ? item('Deactivate', Pause, 'deactivate')
            : item('Activate', Play, 'activate', {
              disabled: !story.isPublished,
              title: story.isPublished ? undefined : 'Publish the story from the editor first',
            })}
          {isAdmin && (
            <>
              <div className="my-1 h-px bg-ink-700" />
              {item('Delete', Trash2, 'delete', { danger: true })}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function StoryCard({ story, isAdmin, onAction }) {
  return (
    <article className="card group flex flex-col overflow-hidden transition-all hover:-translate-y-0.5 hover:border-ink-600">
      <Link to={`/stories/${story.id}/edit`} className="relative block aspect-[16/9] overflow-hidden bg-ink-800">
        {story.thumbnail?.thumbUrl ? (
          <img src={story.thumbnail.thumbUrl} alt="" loading="lazy" className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
        ) : (
          <div className="grid size-full place-items-center text-ink-500"><Images className="size-8" /></div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
        <StatusBadge status={story.status} className="absolute top-3 left-3 bg-black/55 backdrop-blur" />
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <Link to={`/stories/${story.id}/edit`} className="line-clamp-1 text-[15px] font-semibold text-white hover:text-accent-300">{story.title}</Link>
        <p className="mt-1.5 line-clamp-2 min-h-10 text-sm text-ink-400">{story.description || 'No description'}</p>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-400">
          <span>{story.sceneCount} scene{story.sceneCount === 1 ? '' : 's'} · {story.imageCount ?? story.sceneCount} images</span>
          {story.hasUnpublishedChanges && <span className="text-amber-300">Unpublished changes</span>}
        </div>
        <div className="mt-4 flex items-end justify-between border-t border-ink-700/60 pt-4">
          <div className="text-xs leading-relaxed text-ink-400">
            <div>Created {formatDate(story.createdAt)}</div>
            <div>Updated {timeAgo(story.updatedAt)}</div>
          </div>
          <CardMenu story={story} isAdmin={isAdmin} onAction={onAction} />
        </div>
      </div>
    </article>
  );
}

export default function StoriesPage() {
  const toast = useToast();
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || 'all';
  const sort = params.get('sort') || 'newest';
  const page = Number(params.get('page') || 1);
  const search = params.get('q') || '';

  const [query, setQuery] = useState(search);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [toDelete, setToDelete] = useState(null);
  const [busy, setBusy] = useState(false);

  const update = useCallback((patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v && v !== 'all' && !(k === 'page' && v === 1) && !(k === 'sort' && v === 'newest') ? next.set(k, v) : next.delete(k)));
    setParams(next, { replace: true });
  }, [params, setParams]);

  // Debounced search box → URL.
  useEffect(() => {
    if (query === search) return undefined;
    const t = setTimeout(() => update({ q: query.trim(), page: 1 }), 300);
    return () => clearTimeout(t);
  }, [query, search, update]);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    storiesApi
      .list({ page, limit: LIMIT, status, sort, search })
      .then(setData)
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setLoading(false));
  }, [page, status, sort, search]);
  useEffect(load, [load]);

  const onAction = async (action, story) => {
    if (action === 'edit') return navigate(`/stories/${story.id}/edit`);
    if (action === 'preview') return navigate(`/stories/${story.id}/preview`, { state: { from: `/stories${params.toString() ? `?${params}` : ''}` } });
    if (action === 'delete') return setToDelete(story);
    try {
      if (action === 'duplicate') {
        const copy = await storiesApi.duplicate(story.id);
        toast.success(`Duplicated as “${copy.title}”.`);
      } else {
        const next = action === 'activate' ? 'active' : 'inactive';
        await storiesApi.setStatus(story.id, next);
        toast.success(next === 'active' ? 'Story is now live on desktop.' : 'Story hidden from desktop.');
      }
      load();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const confirmDelete = async () => {
    setBusy(true);
    try {
      await storiesApi.remove(toDelete.id);
      toast.success('Story deleted.');
      setToDelete(null);
      if (data?.items.length === 1 && page > 1) update({ page: page - 1 });
      else load();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const counts = data?.counts;
  const tabs = [
    { value: 'all', label: `All${counts ? ` ${counts.all}` : ''}` },
    { value: 'active', label: `Active${counts ? ` ${counts.active}` : ''}` },
    { value: 'inactive', label: `Inactive${counts ? ` ${counts.inactive}` : ''}` },
    { value: 'draft', label: `Draft${counts ? ` ${counts.draft}` : ''}` },
  ];
  const pg = data?.pagination;

  return (
    <>
      <PageHeader
        title="Stories"
        description="Create, edit and publish your interactive stories."
        actions={<Link to="/stories/new"><Button variant="primary" icon={Plus}>Add new story</Button></Link>}
      />

      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1 lg:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-400" />
          <input
            type="search"
            className="input pl-10"
            placeholder="Search by title, description, category…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search stories"
          />
        </div>
        <Segmented value={status} onChange={(v) => update({ status: v, page: 1 })} options={tabs} className="overflow-x-auto" />
        <Select
          className="lg:ml-auto lg:w-48"
          value={sort}
          onChange={(v) => update({ sort: v, page: 1 })}
          options={[
            { value: 'newest', label: 'Newest first' },
            { value: 'oldest', label: 'Oldest first' },
            { value: 'updated', label: 'Recently updated' },
            { value: 'title', label: 'Title A–Z' },
          ]}
          aria-label="Sort stories"
        />
      </div>

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : loading && !data ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-[360px] rounded-2xl" />)}
        </div>
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={search || status !== 'all' ? 'No matching stories' : 'No stories yet'}
          description={search || status !== 'all' ? 'Try a different search or filter.' : 'Start by creating your first interactive story.'}
          action={!search && status === 'all' && <Link to="/stories/new"><Button variant="primary" icon={Plus}>Create story</Button></Link>}
        />
      ) : (
        <>
          <div className={cx('grid gap-5 transition-opacity sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4', loading && 'opacity-60')}>
            {data.items.map((s) => <StoryCard key={s.id} story={s} isAdmin={isAdmin} onAction={onAction} />)}
          </div>
          {pg.totalPages > 1 && (
            <nav className="mt-8 flex items-center justify-between text-sm text-ink-400" aria-label="Pagination">
              <span>
                Showing {(pg.page - 1) * pg.limit + 1}–{Math.min(pg.page * pg.limit, pg.total)} of {pg.total}
              </span>
              <div className="flex gap-2">
                <Button size="sm" disabled={pg.page <= 1} onClick={() => update({ page: pg.page - 1 })}>Previous</Button>
                <Button size="sm" disabled={pg.page >= pg.totalPages} onClick={() => update({ page: pg.page + 1 })}>Next</Button>
              </div>
            </nav>
          )}
        </>
      )}

      <ConfirmDialog
        open={!!toDelete}
        title="Delete this story?"
        description={`“${toDelete?.title}” will be permanently deleted, removed from the desktop app, and its unused images deleted. This cannot be undone.`}
        confirmLabel="Delete story"
        loading={busy}
        onConfirm={confirmDelete}
        onClose={() => setToDelete(null)}
      />
    </>
  );
}

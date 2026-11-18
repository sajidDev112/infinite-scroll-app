import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ArrowRight, BookOpen, CircleDot, FileEdit, ImageIcon, PauseCircle, Plus, Radio } from 'lucide-react';
import { storiesApi, errorMessage } from '../lib/api.js';
import { Button } from '../components/ui/Button.jsx';
import { EmptyState, ErrorState, PageHeader, Skeleton, StatusBadge } from '../components/ui/Misc.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { timeAgo } from '../lib/utils.js';

function StatCard({ label, value, icon: Icon, tone, sub }) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-ink-300">{label}</span>
        <span className={`grid size-9 place-items-center rounded-xl ${tone}`}>
          <Icon className="size-[18px]" />
        </span>
      </div>
      <div className="mt-4 text-3xl font-semibold tracking-tight text-white tabular-nums">{value}</div>
      {sub && <div className="mt-1 text-xs text-ink-400">{sub}</div>}
    </div>
  );
}

function StatusOverview({ totals }) {
  const parts = [
    { key: 'active', label: 'Active', color: 'bg-emerald-400' },
    { key: 'inactive', label: 'Inactive', color: 'bg-ink-400' },
    { key: 'draft', label: 'Draft', color: 'bg-amber-400' },
  ];
  const total = totals.total || 0;
  return (
    <div className="card p-6">
      <h2 className="text-[15px] font-semibold text-white">Story status</h2>
      <p className="mt-1 text-sm text-ink-400">{totals.live} live in the desktop app</p>
      <div className="mt-6 flex h-2.5 overflow-hidden rounded-full bg-ink-750">
        {total > 0 && parts.map((p) => (
          <div key={p.key} className={`${p.color} transition-all`} style={{ width: `${(totals[p.key] / total) * 100}%` }} />
        ))}
      </div>
      <ul className="mt-6 space-y-3">
        {parts.map((p) => (
          <li key={p.key} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2.5 text-ink-200">
              <span className={`size-2 rounded-full ${p.color}`} />
              {p.label}
            </span>
            <span className="tabular-nums text-ink-300">
              {totals[p.key]}
              <span className="ml-2 text-ink-500">{total ? Math.round((totals[p.key] / total) * 100) : 0}%</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function DashboardPage() {
  const { admin } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setError('');
    storiesApi.stats().then(setData).catch((e) => setError(errorMessage(e)));
  }, []);
  useEffect(load, [load]);

  const t = data?.totals;
  return (
    <>
      <PageHeader
        title={`Welcome to Infinite Scroll Stories`}
        description="Here's what's happening with your stories."
        actions={<Link to="/stories/new"><Button variant="primary" icon={Plus}>New story</Button></Link>}
      />

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {t ? (
              <>
                <StatCard label="Total stories" value={t.total} icon={BookOpen} tone="bg-accent-500/15 text-accent-300" />
                <StatCard label="Active" value={t.active} icon={Radio} tone="bg-emerald-500/15 text-emerald-300" sub="Visible on desktop" />
                <StatCard label="Inactive" value={t.inactive} icon={PauseCircle} tone="bg-ink-600/40 text-ink-200" />
                <StatCard label="Drafts" value={t.draft} icon={FileEdit} tone="bg-amber-500/15 text-amber-300" />
                <StatCard label="Total images" value={t.images} icon={ImageIcon} tone="bg-violet-500/15 text-violet-300" />
              </>
            ) : (
              Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-[132px] rounded-2xl" />)
            )}
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_340px]">
            <div className="card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-[15px] font-semibold text-white">Recently updated</h2>
                  <p className="mt-1 text-sm text-ink-400">Pick up where you left off.</p>
                </div>
                <Link to="/stories" className="flex items-center gap-1 text-sm font-medium text-accent-300 hover:text-accent-400">
                  All stories <ArrowRight className="size-4" />
                </Link>
              </div>
              <div className="mt-5 divide-y divide-ink-700/60">
                {!data && Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="my-3 h-14" />)}
                {data?.recentStories.length === 0 && (
                  <EmptyState
                    className="mt-2 border-none"
                    icon={BookOpen}
                    title="No stories yet"
                    description="Create your first interactive story to see it here."
                    action={<Link to="/stories/new"><Button variant="primary" icon={Plus}>Create story</Button></Link>}
                  />
                )}
                {data?.recentStories.map((s) => (
                  <Link key={s.id} to={`/stories/${s.id}/edit`} className="group -mx-3 flex items-center gap-4 rounded-xl px-3 py-3 hover:bg-ink-800">
                    <div className="h-12 w-20 shrink-0 overflow-hidden rounded-lg bg-ink-750">
                      {s.thumbnail?.thumbUrl && <img src={s.thumbnail.thumbUrl} alt="" className="size-full object-cover" loading="lazy" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-white group-hover:text-accent-300">{s.title}</div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-ink-400">
                        <span>{s.sceneCount} scene{s.sceneCount === 1 ? '' : 's'}</span>
                        <CircleDot className="size-1.5" />
                        <span>Updated {timeAgo(s.updatedAt)}</span>
                        {s.hasUnpublishedChanges && <span className="text-amber-300">· Unpublished changes</span>}
                      </div>
                    </div>
                    <StatusBadge status={s.status} />
                  </Link>
                ))}
              </div>
            </div>
            {t ? <StatusOverview totals={t} /> : <Skeleton className="h-72 rounded-2xl" />}
          </div>
        </>
      )}
    </>
  );
}

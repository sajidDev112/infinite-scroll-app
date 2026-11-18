import { Loader2 } from 'lucide-react';
import { cx } from '../../lib/utils.js';

const STATUS = {
  active: { label: 'Active', cls: 'bg-emerald-500/12 text-emerald-300 ring-emerald-500/25', dot: 'bg-emerald-400' },
  inactive: { label: 'Inactive', cls: 'bg-ink-600/30 text-ink-200 ring-ink-500/40', dot: 'bg-ink-400' },
  draft: { label: 'Draft', cls: 'bg-amber-500/12 text-amber-300 ring-amber-500/25', dot: 'bg-amber-400' },
};

export function StatusBadge({ status, className }) {
  const s = STATUS[status] || STATUS.draft;
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset', s.cls, className)}>
      <span className={cx('size-1.5 rounded-full', s.dot)} />
      {s.label}
    </span>
  );
}

export function Spinner({ className, label }) {
  return (
    <div className={cx('flex items-center justify-center gap-3 text-ink-300', className)} role="status">
      <Loader2 className="size-5 animate-spin" />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div className={cx('flex flex-col items-center justify-center rounded-2xl border border-dashed border-ink-700 px-6 py-16 text-center', className)}>
      {Icon && (
        <div className="mb-4 grid size-12 place-items-center rounded-xl bg-ink-800 text-ink-300 ring-1 ring-ink-700">
          <Icon className="size-6" />
        </div>
      )}
      <h3 className="text-base font-semibold text-white">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm text-ink-400">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="rounded-2xl border border-rose-500/25 bg-rose-500/5 px-6 py-10 text-center">
      <p className="text-sm text-rose-200">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-4 text-sm font-medium text-white underline underline-offset-4 hover:text-accent-300">
          Try again
        </button>
      )}
    </div>
  );
}

export function PageHeader({ title, description, actions }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-400">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Skeleton({ className }) {
  return <div className={cx('animate-pulse rounded-lg bg-ink-800', className)} />;
}

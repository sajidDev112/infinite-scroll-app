import { useState } from 'react';
import { NavLink, Navigate, Outlet, useLocation } from 'react-router';
import { BookOpen, LayoutDashboard, LogOut, Menu, Settings, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { Spinner } from '../ui/Misc.jsx';
import { ConfirmDialog } from '../ui/Modal.jsx';
import { cx } from '../../lib/utils.js';

export function ProtectedRoute({ children }) {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'checking') return <Spinner className="h-full" label="Checking session…" />;
  if (status !== 'signed-in') return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return children;
}

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/stories', label: 'Stories', icon: BookOpen },
];

export function Brand({ className, size = 'md' }) {
  return (
    <div className={cx('flex items-center', className)}>
      {/* White logo on transparent background — made for the dark UI. */}
      <img src={`${import.meta.env.BASE_URL}brand-logo.png`} alt="MAP — Museum of Art & Photography" className={cx('w-auto select-none', size === 'sm' ? 'h-10' : 'h-20')} draggable={false} />
    </div>
  );
}

function Sidebar({ onNavigate }) {
  const { admin, logout } = useAuth();
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="flex h-full flex-col">
      <Brand className="px-5 pt-6 pb-8" />
      <nav className="flex-1 space-y-1 px-3" aria-label="Main">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) => cx(
              'group flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors',
              isActive ? 'bg-ink-750 text-white shadow-card' : 'text-ink-300 hover:bg-ink-800 hover:text-white',
            )}
          >
            {({ isActive }) => (
              <>
                <Icon className={cx('size-[18px]', isActive ? 'text-accent-400' : 'text-ink-400 group-hover:text-ink-200')} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Account footer: who is signed in, then Settings and Log Out side by side. */}
      <div className="border-t border-ink-700/70 px-4 pt-4 pb-5">
        <div className="truncate text-[15px] font-semibold text-white" title={admin?.name}>{admin?.name || 'Admin'}</div>
        <div className="truncate text-[13px] text-ink-400" title={admin?.email}>{admin?.email}</div>
        <div className="mt-4 flex gap-2">
          <NavLink
            to="/settings"
            onClick={onNavigate}
            className={({ isActive }) => cx(
              'flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border text-sm font-medium transition-colors',
              isActive
                ? 'border-accent-500/60 bg-accent-500/10 text-white'
                : 'border-ink-600 text-ink-100 hover:border-ink-500 hover:bg-ink-800',
            )}
          >
            <Settings className="size-4" />
            Settings
          </NavLink>
          <button
            type="button"
            onClick={() => setConfirm(true)}
            className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-rose-500/40 text-sm font-medium text-rose-400 transition-colors hover:border-rose-500/70 hover:bg-rose-500/10 hover:text-rose-300"
          >
            <LogOut className="size-4" />
            Log Out
          </button>
        </div>
      </div>
      <ConfirmDialog
        open={confirm}
        title="Sign out?"
        description="You will need to sign in again to manage stories."
        confirmLabel="Sign out"
        tone="primary"
        onConfirm={logout}
        onClose={() => setConfirm(false)}
      />
    </div>
  );
}

export default function AppLayout() {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-full">
      <aside className="panel fixed inset-y-0 left-0 z-30 hidden w-64 border-r lg:block">
        <Sidebar />
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="panel anim-pop absolute inset-y-0 left-0 w-72 border-r">
            <button type="button" className="absolute top-5 right-4 p-1 text-ink-300" onClick={() => setOpen(false)} aria-label="Close menu">
              <X className="size-5" />
            </button>
            <Sidebar onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-ink-700/70 bg-ink-950/85 px-4 backdrop-blur lg:hidden">
          <button type="button" onClick={() => setOpen(true)} className="p-1.5 text-ink-200" aria-label="Open menu">
            <Menu className="size-5" />
          </button>
          <Brand size="sm" />
        </header>
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-8 sm:px-8 lg:py-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

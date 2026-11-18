import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
import { cx } from '../lib/utils.js';

const ToastContext = createContext(null);

const ICONS = { success: CheckCircle2, error: AlertTriangle, info: Info };
const TONES = {
  success: 'text-emerald-400',
  error: 'text-rose-400',
  info: 'text-accent-300',
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const seq = useRef(0);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback(
    (type, message, ms = type === 'error' ? 6000 : 3200) => {
      const id = ++seq.current;
      setToasts((t) => [...t.slice(-3), { id, type, message }]);
      setTimeout(() => dismiss(id), ms);
    },
    [dismiss],
  );

  const api = useMemo(
    () => ({
      success: (m) => push('success', m),
      error: (m) => push('error', m),
      info: (m) => push('info', m),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[100] flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-2" aria-live="polite">
        {toasts.map((t) => {
          const Icon = ICONS[t.type];
          return (
            <div key={t.id} role="status" className="anim-toast pointer-events-auto flex items-start gap-3 rounded-xl border border-ink-700 bg-ink-800/95 px-4 py-3 shadow-pop backdrop-blur">
              <Icon className={cx('mt-0.5 size-4 shrink-0', TONES[t.type])} />
              <p className="flex-1 text-sm text-ink-100">{t.message}</p>
              <button type="button" onClick={() => dismiss(t.id)} className="text-ink-400 hover:text-ink-100" aria-label="Dismiss">
                <X className="size-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

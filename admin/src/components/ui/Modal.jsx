import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button } from './Button.jsx';
import { cx } from '../../lib/utils.js';

export function Modal({ open, onClose, title, description, children, footer, size = 'md' }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.activeElement;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    requestAnimationFrame(() => ref.current?.querySelector('[data-autofocus], button, input')?.focus());
    return () => {
      document.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="anim-fade fixed inset-0 z-[90] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={cx('anim-pop w-full rounded-2xl border border-ink-700 bg-ink-850 shadow-pop', size === 'lg' ? 'max-w-2xl' : 'max-w-md')}
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-5">
          <div>
            <h2 id="modal-title" className="text-lg font-semibold text-white">{title}</h2>
            {description && <p className="mt-1 text-sm text-ink-300">{description}</p>}
          </div>
          <button type="button" onClick={onClose} className="-mr-2 rounded-lg p-1.5 text-ink-400 hover:bg-ink-750 hover:text-white" aria-label="Close">
            <X className="size-5" />
          </button>
        </div>
        {children && <div className="px-6 pt-4">{children}</div>}
        <div className="flex justify-end gap-2 px-6 pb-5 pt-6">{footer}</div>
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({ open, title, description, confirmLabel = 'Confirm', tone = 'danger', loading, onConfirm, onClose }) {
  return (
    <Modal
      open={open}
      onClose={loading ? undefined : onClose}
      title={title}
      description={description}
      footer={(
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={loading} data-autofocus>
            {confirmLabel}
          </Button>
        </>
      )}
    />
  );
}

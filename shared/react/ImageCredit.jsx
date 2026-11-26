import { useId, useState } from 'react';
import { RichText } from './RichText.jsx';

/**
 * The (i) icon: black disc, white ring, italic serif "i". Transparent around the circle.
 * `dashed` draws the ring dashed (the editor uses it for "no credit yet").
 */
export function InfoIcon({ dashed = false, className }) {
  return (
    <svg className={className} viewBox="0 0 32 32" width="100%" height="100%" aria-hidden="true" focusable="false">
      <circle cx="16" cy="16" r="14.6" fill="#000" stroke="#fff" strokeWidth="2.2" strokeDasharray={dashed ? '4 3' : undefined} />
      {/* dot */}
      <circle cx="17.6" cy="9.4" r="2.15" fill="#fff" />
      {/* italic stem with a small foot */}
      <path
        d="M14.2 14.2h4.1l-2.2 8.4c-.15.6.05.85.5.85.45 0 1-.3 1.55-.85l.55.6c-.95 1.15-2.1 1.8-3.3 1.8-1.45 0-2.1-.85-1.75-2.25l1.65-6.3h-1.4z"
        fill="#fff"
      />
    </svg>
  );
}

/**
 * Small (i) button at the bottom right of an image. Hovering it (or focusing it with the
 * keyboard) shows the image credit; on touch screens a tap toggles it. Nothing when no credit.
 */
export function ImageCredit({ text }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const credit = typeof text === 'string' ? text.trim() : '';
  if (!credit) return null;
  return (
    <div className={`sp-credit${open ? ' is-open' : ''}`} onMouseLeave={() => setOpen(false)}>
      <div className="sp-credit-box" id={id} role="note"><RichText text={credit} liveLinks /></div>
      <button
        type="button"
        className="sp-credit-btn"
        aria-label="Image credit"
        aria-describedby={id}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
        onBlur={() => setOpen(false)}
      >
        <InfoIcon />
      </button>
    </div>
  );
}

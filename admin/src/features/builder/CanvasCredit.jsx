import { useEffect, useRef, useState } from 'react';
import { IMAGE_CREDIT_MAX } from '@shared/engine/defaults.js';
import { Button } from '../../components/ui/Button.jsx';
import { cx } from '../../lib/utils.js';
import { InfoIcon } from '@shared/react/ImageCredit.jsx';
import { RichText } from '@shared/react/RichText.jsx';
import { FormatBar, italicShortcut } from './ItalicWords.jsx';

/**
 * The viewer's (i) image-credit icon, placed on the editor stage at the bottom right of the
 * picture (`frame` = the picture's box on the stage, default the whole stage).
 * Hover shows the credit like viewers see it; click opens a box to write it for this image.
 * Without a credit the icon is dashed, and viewers don't see one.
 */
export default function CanvasCredit({ value, onChange, imageLabel, frame }) {
  const [open, setOpen] = useState(false);
  const areaRef = useRef(null);
  const text = value || '';
  const has = text.trim().length > 0;

  useEffect(() => {
    if (!open) return undefined;
    const t = setTimeout(() => areaRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [open]);

  return (
    <div className="pointer-events-none absolute z-30" style={frame || { inset: 0 }}>
      <div
        className="sp-credit"
        // The stage deselects text on pointer down; keep clicks here to ourselves.
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {!open && has && <div className="sp-credit-box" role="tooltip"><RichText text={text.trim()} /></div>}
        {open && (
          <div className="w-[min(340px,70vw)] rounded-xl border border-ink-600 bg-ink-900 p-3 text-left shadow-pop">
            <label htmlFor="canvas-credit" className="mb-1.5 block text-[13px] font-medium text-ink-100">
              Image credit{imageLabel ? <span className="font-normal text-ink-400"> · {imageLabel}</span> : null}
            </label>
            <textarea
              ref={areaRef}
              id="canvas-credit"
              rows={4}
              maxLength={IMAGE_CREDIT_MAX}
              value={text}
              placeholder="Title; artist; date; medium; size. Museum, city"
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); else italicShortcut(text, onChange)(e); }}
              className="input h-auto w-full resize-y py-2 text-[13px] leading-relaxed"
            />
            <FormatBar fieldRef={areaRef} value={text} onChange={onChange} compact className="mt-2" />
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="mr-auto text-[11px] text-ink-400 tabular-nums">{text.length}/{IMAGE_CREDIT_MAX}</span>
              <div className="flex gap-1.5">
                {has && <Button size="sm" variant="ghost" onClick={() => onChange('')}>Clear</Button>}
                <Button size="sm" variant="primary" onClick={() => setOpen(false)}>Done</Button>
              </div>
            </div>
          </div>
        )}
        <button
          type="button"
          className={cx('sp-credit-btn', !has && 'opacity-75')}
          aria-label={has ? 'Edit image credit' : 'Add image credit'}
          aria-expanded={open}
          title={has ? 'Edit image credit' : 'Add image credit (viewers see it behind this icon)'}
          onClick={() => setOpen((o) => !o)}
        >
          <InfoIcon dashed={!has} />
        </button>
      </div>
    </div>
  );
}

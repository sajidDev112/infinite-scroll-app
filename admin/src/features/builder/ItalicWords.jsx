import { useEffect, useRef, useState } from 'react';
import { Italic, Link2 } from 'lucide-react';
import { linkAt, removeLink, safeHref, setLink, toggleItalic } from '@shared/engine/richText.js';
import { cx } from '../../lib/utils.js';
import { Textarea } from '../../components/ui/Fields.jsx';

/*
 * Formatting for story text fields (text boxes and image credits): select words, then
 *   Italic (Ctrl+I) → *words*        Link (Ctrl+K) → [words](https://…)
 * The published story shows them in italics / as links that open in a new tab.
 */

/** Puts the new text in and re-selects the words in the field. */
function commit(el, r, onChange) {
  onChange(r.value);
  requestAnimationFrame(() => {
    if (!el) return;
    el.focus();
    el.setSelectionRange(r.start, r.end);
  });
}

/** Makes the selected words of a textarea/input italic (or plain again), keeping the selection. */
export function applyItalic(el, value, onChange) {
  if (!el) return;
  const r = toggleItalic(value, el.selectionStart, el.selectionEnd);
  if (r.value !== value) commit(el, r, onChange);
}

/** onKeyDown for a text field: Ctrl+I / Cmd+I toggles italics on the selected words. */
export const italicShortcut = (value, onChange) => (e) => {
  if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'i') {
    e.preventDefault();
    applyItalic(e.currentTarget, value, onChange);
  }
};

const toolBtn = 'inline-flex h-7 items-center gap-1 rounded-md border border-ink-700 px-2 text-xs text-ink-200 hover:border-ink-500 hover:text-white';

/** "Italic" button for a text field (`fieldRef`): select words, click it. */
export function ItalicWordsButton({ fieldRef, value, onChange, className }) {
  return (
    <button
      type="button"
      // Keep the text selection in the field when the button is pressed.
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => applyItalic(fieldRef.current, value, onChange)}
      title="Italic: select words, then click (Ctrl+I). They are written as *words* and shown in italics."
      className={cx(toolBtn, className)}
    >
      <Italic className="size-3.5" /> Italic
    </button>
  );
}

/** One-line hint under a field that supports formatting. */
export function ItalicHint() {
  return (
    <span>
      Select words, then <b className="font-semibold">Italic</b> (Ctrl+I) or <b className="font-semibold">Link</b> (Ctrl+K). Here they show as{' '}
      <code className="text-ink-200">*words*</code> and <code className="text-ink-200">[words](address)</code>.
    </span>
  );
}

/**
 * Italic + Link buttons for a text field, with the link address box. Also adds Ctrl+K to the
 * field. `compact` hides the hint line.
 */
export function FormatBar({ fieldRef, value, onChange, compact = false, className }) {
  const text = value || '';
  const [edit, setEdit] = useState(null); // { start, end, url, existing, error }
  const urlRef = useRef(null);
  const state = useRef({ text, edit });
  state.current = { text, edit };

  const openLink = () => {
    const el = fieldRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? start;
    const existing = linkAt(state.current.text, start, end);
    setEdit({ start, end, url: existing?.href || '', existing: Boolean(existing), error: '' });
  };

  // Ctrl+K / Cmd+K in the field opens the link box.
  useEffect(() => {
    const el = fieldRef.current;
    if (!el) return undefined;
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openLink();
      }
    };
    el.addEventListener('keydown', onKey);
    return () => el.removeEventListener('keydown', onKey);
  });

  useEffect(() => {
    if (edit) requestAnimationFrame(() => urlRef.current?.focus());
  }, [edit?.start, edit?.end, Boolean(edit)]); // eslint-disable-line react-hooks/exhaustive-deps

  const apply = () => {
    const href = safeHref(edit.url);
    if (!href) return setEdit({ ...edit, error: 'Enter a web address, e.g. https://imp-art.org/…' });
    const r = setLink(text, edit.start, edit.end, href);
    if (!r) return setEdit({ ...edit, error: 'Select the words to link in the text first.' });
    setEdit(null);
    commit(fieldRef.current, r, onChange);
  };
  const unlink = () => {
    const r = removeLink(text, edit.start, edit.end);
    setEdit(null);
    if (r) commit(fieldRef.current, r, onChange);
  };

  return (
    <div className={className}>
      <div className="flex items-start gap-2">
        <ItalicWordsButton fieldRef={fieldRef} value={text} onChange={onChange} className="shrink-0" />
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={openLink}
          aria-expanded={Boolean(edit)}
          title="Link: select words, then click (Ctrl+K) and paste the web address. Viewers can click them."
          className={cx(toolBtn, 'shrink-0', edit && 'border-accent-500 text-white')}
        >
          <Link2 className="size-3.5" /> Link
        </button>
        {!compact && <p className="text-xs leading-relaxed text-ink-400"><ItalicHint /></p>}
      </div>
      {edit && (
        <div className="mt-2 rounded-lg border border-ink-700 bg-ink-950/60 p-2.5">
          <label className="mb-1 block text-xs font-medium text-ink-200" htmlFor={`link-url-${fieldRef.current?.id || 'field'}`}>
            {edit.existing ? 'Link address' : 'Link the selected words to'}
          </label>
          <input
            ref={urlRef}
            id={`link-url-${fieldRef.current?.id || 'field'}`}
            type="url"
            inputMode="url"
            className="input h-8 w-full text-[13px]"
            placeholder="https://"
            value={edit.url}
            onChange={(e) => setEdit({ ...edit, url: e.target.value, error: '' })}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') { e.preventDefault(); apply(); }
              if (e.key === 'Escape') { e.preventDefault(); setEdit(null); fieldRef.current?.focus(); }
            }}
          />
          {edit.error && <p className="mt-1 text-xs text-rose-400" role="alert">{edit.error}</p>}
          <div className="mt-2 flex items-center justify-end gap-1.5">
            {edit.existing && (
              <button type="button" onClick={unlink} className="mr-auto h-7 rounded-md px-2 text-xs text-rose-300 hover:bg-rose-500/10">Remove link</button>
            )}
            <button type="button" onClick={() => setEdit(null)} className="h-7 rounded-md px-2 text-xs text-ink-300 hover:text-white">Cancel</button>
            <button type="button" onClick={apply} className="h-7 rounded-md bg-accent-500 px-2.5 text-xs font-medium text-white hover:bg-accent-400">
              {edit.existing ? 'Update link' : 'Add link'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Textarea with Italic / Link formatting, for fields that support it. */
export function ItalicTextarea({ value, onChange, ...props }) {
  const ref = useRef(null);
  const text = value || '';
  return (
    <div>
      <Textarea ref={ref} value={text} onChange={(e) => onChange(e.target.value)} onKeyDown={italicShortcut(text, onChange)} {...props} />
      <FormatBar fieldRef={ref} value={text} onChange={onChange} className="mt-1.5" />
    </div>
  );
}

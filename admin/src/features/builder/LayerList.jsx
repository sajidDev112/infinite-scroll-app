import { stripItalics } from '@shared/engine/richText.js';
import { ArrowDown, ArrowUp, Copy, Trash2, Type } from 'lucide-react';
import { cx } from '../../lib/utils.js';

/** Text layers, top-most first. */
export default function LayerList({ texts, selectedId, onSelect, onLayer, onDuplicate, onDelete, emptyHint }) {
  const sorted = [...texts].sort((a, b) => (b.zIndex ?? 1) - (a.zIndex ?? 1));
  if (!sorted.length) return <p className="px-5 py-6 text-sm text-ink-400">{emptyHint || 'No text yet.'}</p>;
  return (
    <ul className="space-y-1 p-3">
      {sorted.map((t, i) => (
        <li key={t.id}>
          <div
            className={cx(
              'group flex items-center gap-2 rounded-lg border px-2.5 py-2 transition-colors',
              t.id === selectedId ? 'border-accent-500/60 bg-accent-500/10' : 'border-transparent hover:bg-ink-800',
            )}
          >
            <button type="button" onClick={() => onSelect(t.id)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
              <Type className="size-4 shrink-0 text-ink-400" />
              <span className="truncate text-sm text-ink-100">{stripItalics(t.content).trim() || <em className="text-rose-300">Empty text</em>}</span>
            </button>
            <div className="flex opacity-60 group-hover:opacity-100">
              <button type="button" disabled={i === 0} onClick={() => onLayer(t.id, 'up')} className="rounded p-1 text-ink-300 hover:text-white disabled:opacity-30" aria-label="Bring forward"><ArrowUp className="size-3.5" /></button>
              <button type="button" disabled={i === sorted.length - 1} onClick={() => onLayer(t.id, 'down')} className="rounded p-1 text-ink-300 hover:text-white disabled:opacity-30" aria-label="Send backward"><ArrowDown className="size-3.5" /></button>
              <button type="button" onClick={() => onDuplicate(t.id)} className="rounded p-1 text-ink-300 hover:text-white" aria-label="Duplicate"><Copy className="size-3.5" /></button>
              <button type="button" onClick={() => onDelete(t.id)} className="rounded p-1 text-ink-300 hover:text-rose-300" aria-label="Delete"><Trash2 className="size-3.5" /></button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

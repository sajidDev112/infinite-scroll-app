import { Maximize, Minus, Plus } from 'lucide-react';
import { STAGE_ASPECTS } from '@shared/engine/constants.js';
import { Select } from '../../components/ui/Fields.jsx';

export const ZOOMS = [1, 1.25, 1.5, 2];

/** Aspect + canvas zoom controls shared by the editors. */
export function StageControls({ aspect, onAspect, zoom, onZoom }) {
  const i = ZOOMS.indexOf(zoom);
  return (
    <div className="flex items-center gap-2">
      <Select className="h-8 w-[92px] text-[13px]" value={aspect} onChange={(v) => onAspect(Number(v))} options={STAGE_ASPECTS} aria-label="Screen shape" />
      <div className="flex h-8 items-center rounded-lg border border-ink-700 bg-ink-950/60">
        <button type="button" disabled={i <= 0} onClick={() => onZoom(ZOOMS[i - 1])} className="grid h-full w-8 place-items-center text-ink-300 hover:text-white disabled:opacity-30" aria-label="Zoom out"><Minus className="size-3.5" /></button>
        <span className="w-12 text-center text-xs text-ink-200 tabular-nums">{zoom === 1 ? 'Fit' : `${Math.round(zoom * 100)}%`}</span>
        <button type="button" disabled={i >= ZOOMS.length - 1} onClick={() => onZoom(ZOOMS[i + 1])} className="grid h-full w-8 place-items-center text-ink-300 hover:text-white disabled:opacity-30" aria-label="Zoom in"><Plus className="size-3.5" /></button>
      </div>
      <button type="button" onClick={() => onZoom(1)} className="grid size-8 place-items-center rounded-lg border border-ink-700 text-ink-300 hover:text-white" title="Fit to screen" aria-label="Fit to screen"><Maximize className="size-3.5" /></button>
    </div>
  );
}

export function PanelTabs({ tabs, value, onChange }) {
  return (
    <div className="flex border-b border-ink-700/70 px-2" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          role="tab"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          disabled={t.disabled}
          className={`relative h-11 flex-1 text-[13px] font-medium transition-colors disabled:opacity-40 ${value === t.value ? 'text-white' : 'text-ink-400 hover:text-ink-200'}`}
        >
          {t.label}
          {value === t.value && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-accent-400" />}
        </button>
      ))}
    </div>
  );
}

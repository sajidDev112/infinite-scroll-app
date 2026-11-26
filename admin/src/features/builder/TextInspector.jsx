import { useEffect, useRef, useState } from 'react';
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, ArrowDownToLine, ArrowUpToLine, ChevronDown, Copy, Italic, Trash2, Underline,
} from 'lucide-react';
import { Link } from 'react-router';
import { ANIMATION_TYPES, FONT_WEIGHTS } from '@shared/engine/constants.js';
import { fontFamilyOptions } from '@shared/engine/fonts.js';
import { useCustomFonts } from '../../hooks/useCustomFonts.js';
import { EASINGS } from '@shared/engine/easing.js';
import { ColorField, NumberInput, RangeField, Segmented, Select, Textarea, Toggle } from '../../components/ui/Fields.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { cx } from '../../lib/utils.js';
import { FormatBar, italicShortcut } from './ItalicWords.jsx';

function Section({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b border-ink-700/70">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between px-5 py-3.5 text-left" aria-expanded={open}>
        <span className="section-title">{title}</span>
        <ChevronDown className={cx('size-4 text-ink-400 transition-transform', !open && '-rotate-90')} />
      </button>
      {open && <div className="space-y-4 px-5 pb-5">{children}</div>}
    </section>
  );
}

function Pair({ children }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>;
}

function Num({ label, ...props }) {
  return (
    <div>
      <span className="label">{label}</span>
      <NumberInput {...props} aria-label={label} />
    </div>
  );
}

/**
 * Property panel for one text element.
 * timing 'seconds' → intro screen; timing 'scroll' → scene step (fractions of scene scroll).
 */
export default function TextInspector({ text, onChange, onDuplicate, onDelete, onLayer, timing = 'scroll', focusSignal }) {
  const contentRef = useRef(null);
  useEffect(() => {
    if (focusSignal) contentRef.current?.focus();
  }, [focusSignal]);

  if (!text) return null;
  const set = (patch) => onChange(patch);
  const bgType = text.backgroundType || 'none';
  const scroll = timing === 'scroll';

  // Built-in fonts plus the ones uploaded in Settings → Fonts.
  const customFonts = useCustomFonts();
  const baseOptions = fontFamilyOptions(customFonts).map((o) => ({ ...o, style: { fontFamily: `'${o.value}', 'Inter Variable'` } }));
  const fontMissing = Boolean(text.fontFamily) && !baseOptions.some((o) => o.value === text.fontFamily);
  const fontOptions = fontMissing ? [...baseOptions, { value: text.fontFamily, label: `${text.fontFamily} (missing)` }] : baseOptions;
  // For an uploaded font, mark the weights it really has; others are imitated by the browser.
  const custom = customFonts.find((f) => f.family === text.fontFamily);
  const weights = custom ? [...new Set([...FONT_WEIGHTS, ...custom.files.map((f) => f.weight)])].sort((a, b) => a - b) : FONT_WEIGHTS;
  const weightOptions = weights.map((w) => ({
    value: w,
    label: custom && !custom.files.some((f) => f.weight === w) ? `${w} (not uploaded)` : String(w),
  }));

  return (
    <div>
      <div className="flex items-center justify-between gap-2 border-b border-ink-700/70 px-5 py-3">
        <span className="text-sm font-medium text-white">Text box</span>
        <div className="flex gap-1">
          <Button size="icon-sm" variant="ghost" onClick={() => onLayer('up')} title="Bring forward" aria-label="Bring forward"><ArrowUpToLine className="size-4" /></Button>
          <Button size="icon-sm" variant="ghost" onClick={() => onLayer('down')} title="Send backward" aria-label="Send backward"><ArrowDownToLine className="size-4" /></Button>
          <Button size="icon-sm" variant="ghost" onClick={onDuplicate} title="Duplicate (Ctrl+D)" aria-label="Duplicate text"><Copy className="size-4" /></Button>
          <Button size="icon-sm" variant="danger-ghost" onClick={onDelete} title="Delete (Del)" aria-label="Delete text"><Trash2 className="size-4" /></Button>
        </div>
      </div>

      <Section title="Content">
        <Textarea ref={contentRef} rows={3} value={text.content} maxLength={2000} onChange={(e) => set({ content: e.target.value })} onKeyDown={italicShortcut(text.content, (v) => set({ content: v }))} placeholder="Type your text…" aria-label="Text content" />
        <FormatBar fieldRef={contentRef} value={text.content} onChange={(v) => set({ content: v })} className="-mt-2" />
      </Section>

      <Section title="Typography">
        <div>
          <Select value={text.fontFamily} onChange={(v) => set({ fontFamily: v })} options={fontOptions} aria-label="Font family" style={{ fontFamily: `'${text.fontFamily}', 'Inter Variable'` }} />
          {fontMissing ? (
            <p className="mt-1.5 text-xs text-amber-300">This font was deleted, so the text shows in Inter. Choose another font or upload it again.</p>
          ) : (
            <p className="mt-1.5 text-xs text-ink-500">
              Need another font? <Link to="/settings#fonts" target="_blank" rel="noopener" className="text-ink-300 underline-offset-2 hover:underline">Upload it in Settings → Fonts</Link>
            </p>
          )}
        </div>
        <Pair>
          <Num label="Size" value={text.fontSize} min={4} max={400} step={1} onChange={(v) => set({ fontSize: Math.round(v) })} suffix="px" />
          <div>
            <span className="label">Weight</span>
            <Select value={text.fontWeight} onChange={(v) => set({ fontWeight: Number(v) })} options={weightOptions} aria-label="Font weight" />
          </div>
        </Pair>
        <div className="flex gap-2">
          <Segmented
            value={text.textAlignment}
            onChange={(v) => set({ textAlignment: v })}
            options={[
              { value: 'left', label: '', icon: AlignLeft, title: 'Align left' },
              { value: 'center', label: '', icon: AlignCenter, title: 'Align center' },
              { value: 'right', label: '', icon: AlignRight, title: 'Align right' },
              { value: 'justify', label: '', icon: AlignJustify, title: 'Justify' },
            ]}
          />
          <button type="button" aria-pressed={text.fontStyle === 'italic'} title="Italic (whole text box)" aria-label="Italic (whole text box)" onClick={() => set({ fontStyle: text.fontStyle === 'italic' ? 'normal' : 'italic' })} className={cx('grid size-9 place-items-center rounded-lg border border-ink-700', text.fontStyle === 'italic' ? 'bg-ink-700 text-white' : 'text-ink-300 hover:text-white')}>
            <Italic className="size-4" />
          </button>
          <button type="button" aria-pressed={text.textDecoration === 'underline'} title="Underline" onClick={() => set({ textDecoration: text.textDecoration === 'underline' ? 'none' : 'underline' })} className={cx('grid size-9 place-items-center rounded-lg border border-ink-700', text.textDecoration === 'underline' ? 'bg-ink-700 text-white' : 'text-ink-300 hover:text-white')}>
            <Underline className="size-4" />
          </button>
        </div>
        <Pair>
          <Num label="Letter spacing" value={text.letterSpacing} min={-0.2} max={1} step={0.01} onChange={(v) => set({ letterSpacing: v })} suffix="em" />
          <Num label="Line height" value={text.lineHeight} min={0.6} max={4} step={0.05} onChange={(v) => set({ lineHeight: v })} />
        </Pair>
        <div>
          <span className="label">Text transform</span>
          <Segmented
            size="sm"
            className="w-full"
            value={text.textTransform}
            onChange={(v) => set({ textTransform: v })}
            options={[
              { value: 'none', label: 'Aa' },
              { value: 'uppercase', label: 'AA' },
              { value: 'lowercase', label: 'aa' },
              { value: 'capitalize', label: 'Ab' },
            ]}
          />
        </div>
      </Section>

      <Section title="Color & background">
        <ColorField label="Text color" value={text.color} onChange={(v) => set({ color: v })} />
        <div>
          <span className="label">Background</span>
          <Segmented
            className="w-full"
            value={bgType}
            onChange={(v) => set({ backgroundType: v })}
            options={[{ value: 'none', label: 'Transparent' }, { value: 'solid', label: 'Solid' }, { value: 'gradient', label: 'Gradient' }]}
          />
        </div>
        {bgType === 'solid' && <ColorField label="Background color" value={text.backgroundColor} onChange={(v) => set({ backgroundColor: v })} />}
        {bgType === 'gradient' && (
          <>
            <Pair>
              <ColorField label="From" value={text.backgroundGradient?.from} onChange={(v) => set({ backgroundGradient: { ...text.backgroundGradient, from: v } })} />
              <ColorField label="To" value={text.backgroundGradient?.to} onChange={(v) => set({ backgroundGradient: { ...text.backgroundGradient, to: v } })} />
            </Pair>
            <RangeField label="Angle" value={text.backgroundGradient?.angle ?? 135} min={0} max={360} step={1} suffix="°" onChange={(v) => set({ backgroundGradient: { ...text.backgroundGradient, angle: v } })} />
          </>
        )}
        {bgType !== 'none' && (
          <RangeField label="Background opacity" value={text.backgroundOpacity} min={0} max={1} step={0.01} scale={100} suffix="%" onChange={(v) => set({ backgroundOpacity: v })} />
        )}
        <Pair>
          <Num label="Padding" value={text.padding} min={0} max={400} onChange={(v) => set({ padding: v })} suffix="px" />
          <Num label="Corner radius" value={text.borderRadius} min={0} max={400} onChange={(v) => set({ borderRadius: v })} suffix="px" />
        </Pair>
        <Pair>
          <Num label="Border width" value={text.borderWidth} min={0} max={40} onChange={(v) => set({ borderWidth: v })} suffix="px" />
          <ColorField label="Border color" value={text.borderColor} onChange={(v) => set({ borderColor: v })} />
        </Pair>
      </Section>

      <Section title="Text shadow" defaultOpen={false}>
        <Toggle id={`shadow-${text.id}`} label="Enable shadow" checked={!!text.shadow?.enabled} onChange={(v) => set({ shadow: { ...text.shadow, enabled: v } })} />
        {text.shadow?.enabled && (
          <>
            <ColorField label="Shadow color" value={text.shadow.color} onChange={(v) => set({ shadow: { ...text.shadow, color: v } })} />
            <div className="grid grid-cols-3 gap-3">
              <Num label="Blur" value={text.shadow.blur} min={0} max={200} onChange={(v) => set({ shadow: { ...text.shadow, blur: v } })} />
              <Num label="X" value={text.shadow.x} min={-200} max={200} onChange={(v) => set({ shadow: { ...text.shadow, x: v } })} />
              <Num label="Y" value={text.shadow.y} min={-200} max={200} onChange={(v) => set({ shadow: { ...text.shadow, y: v } })} />
            </div>
          </>
        )}
      </Section>

      <Section title="Position & size">
        <Pair>
          <Num label="X" value={text.positionX} min={-50} max={120} step={0.1} scale={100} onChange={(v) => set({ positionX: v })} suffix="%" />
          <Num label="Y" value={text.positionY} min={-50} max={120} step={0.1} scale={100} onChange={(v) => set({ positionY: v })} suffix="%" />
        </Pair>
        <Pair>
          <Num label="Width (0 = auto)" value={text.width} min={0} max={100} step={0.5} scale={100} onChange={(v) => set({ width: v })} suffix="%" />
          <Num label="Height (0 = auto)" value={text.height} min={0} max={100} step={0.5} scale={100} onChange={(v) => set({ height: v })} suffix="%" />
        </Pair>
        <RangeField label="Rotation" value={text.rotation} min={-180} max={180} step={1} suffix="°" onChange={(v) => set({ rotation: v })} />
        <div className="flex gap-2">
          <Button size="sm" className="flex-1 justify-center" onClick={() => set({ positionX: Math.round((0.5 - (text.width || 0.4) / 2) * 1000) / 1000 })}>Center horizontally</Button>
        </div>
        <RangeField label="Opacity" value={text.opacity ?? 1} min={0} max={1} step={0.01} scale={100} suffix="%" onChange={(v) => set({ opacity: v })} />
      </Section>

      <Section title="Animation">
        <div>
          <span className="label">Reveal</span>
          <Select value={text.animationType} onChange={(v) => set({ animationType: v })} options={ANIMATION_TYPES} aria-label="Reveal animation" />
        </div>
        {scroll ? (
          <>
            <RangeField label="Duration" value={text.animationDuration} min={0.02} max={0.5} step={0.01} scale={100} suffix="%" hint="Share of the scene's scroll the reveal takes." onChange={(v) => set({ animationDuration: v })} />
            <RangeField label="Delay" value={text.animationDelay} min={0} max={0.5} step={0.01} scale={100} suffix="%" hint="Scroll after the step starts before revealing." onChange={(v) => set({ animationDelay: v })} />
          </>
        ) : (
          <>
            <RangeField label="Duration" value={text.animationDuration} min={0.1} max={4} step={0.05} suffix="s" onChange={(v) => set({ animationDuration: v })} />
            <RangeField label="Delay" value={text.animationDelay} min={0} max={6} step={0.05} suffix="s" onChange={(v) => set({ animationDelay: v })} />
          </>
        )}
        <div>
          <span className="label">Easing</span>
          <Select value={text.easing} onChange={(v) => set({ easing: v })} options={EASINGS} aria-label="Easing" />
        </div>
        {scroll && (
          <Toggle id={`persist-${text.id}`} label="Keep until scene ends" description="Otherwise the text leaves before the next step." checked={!!text.persist} onChange={(v) => set({ persist: v })} />
        )}
      </Section>
    </div>
  );
}

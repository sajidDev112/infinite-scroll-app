import { forwardRef, useEffect, useState } from 'react';
import { cx } from '../../lib/utils.js';

export function Field({ label, htmlFor, error, hint, className, children, right }) {
  return (
    <div className={className}>
      {label && (
        <div className="flex items-center justify-between">
          <label htmlFor={htmlFor} className="label">{label}</label>
          {right}
        </div>
      )}
      {children}
      {error ? <p className="mt-1.5 text-xs text-rose-400" role="alert">{error}</p> : hint ? <p className="hint">{hint}</p> : null}
    </div>
  );
}

export const Input = forwardRef(function Input({ className, error, ...rest }, ref) {
  return <input ref={ref} className={cx('input', error && 'input-error', className)} aria-invalid={!!error || undefined} {...rest} />;
});

export const Textarea = forwardRef(function Textarea({ className, error, rows = 4, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cx('input h-auto resize-y py-2.5 leading-relaxed', error && 'input-error', className)}
      {...rest}
    />
  );
});

export function Select({ className, options, value, onChange, style, ...rest }) {
  return (
    <select
      className={cx('input appearance-none bg-[length:16px] bg-[right_10px_center] bg-no-repeat pr-9', className)}
      style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%239aa1b3' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", ...style }}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      {...rest}
    >
      {options.map((o) => (
        <option key={String(o.value)} value={o.value} disabled={o.disabled} style={o.style}>{o.label}</option>
      ))}
    </select>
  );
}

/**
 * Number input that keeps local text while typing and commits a clamped value
 * on blur/Enter. `scale` converts stored values (e.g. 0.25 → 25 %).
 */
export function NumberInput({ value, onChange, min = -Infinity, max = Infinity, step = 1, scale = 1, suffix, className, ...rest }) {
  const shown = Number.isFinite(value) ? +(value * scale).toFixed(3) : '';
  const [text, setText] = useState(String(shown));
  useEffect(() => setText(String(shown)), [shown]);
  const commit = () => {
    const n = parseFloat(text);
    if (!Number.isFinite(n)) return setText(String(shown));
    const v = Math.min(max, Math.max(min, n)) / scale;
    onChange(v);
    setText(String(+(v * scale).toFixed(3)));
  };
  return (
    <div className={cx('relative', className)}>
      <input
        type="number"
        className={cx('input tabular-nums', suffix ? 'pr-9 pl-2.5' : 'pr-2')}
        value={text}
        step={step}
        min={min}
        max={max}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && commit()}
        {...rest}
      />
      {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-400">{suffix}</span>}
    </div>
  );
}

/** Slider + numeric box. Values are stored unscaled; `scale` is for display. */
export function RangeField({ label, value, onChange, min, max, step, scale = 1, suffix, hint, className }) {
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span className="text-[13px] font-medium text-ink-200">{label}</span>
      </div>
      <div className="flex items-center gap-3">
        <input
          type="range"
          className="h-1.5 min-w-0 flex-1 cursor-pointer"
          min={min}
          max={max}
          step={step}
          value={value ?? min}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          aria-label={label}
        />
        <NumberInput
          className="w-[96px] shrink-0"
          value={value}
          onChange={onChange}
          min={min * scale}
          max={max * scale}
          step={step * scale}
          scale={scale}
          suffix={suffix}
          aria-label={`${label} value`}
        />
      </div>
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

export function Toggle({ checked, onChange, label, description, id }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start justify-between gap-4">
      <span>
        <span className="block text-[13px] font-medium text-ink-200">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-ink-400">{description}</span>}
      </span>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx(
          'relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors',
          checked ? 'bg-accent-500' : 'bg-ink-600',
        )}
      >
        <span className={cx('absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform', checked && 'translate-x-5')} />
      </button>
    </label>
  );
}

/** Pill-style segmented control. */
export function Segmented({ value, onChange, options, className, size = 'md' }) {
  return (
    <div className={cx('inline-flex rounded-lg border border-ink-700 bg-ink-950/60 p-0.5', className)} role="radiogroup">
      {options.map((o) => {
        const Icon = o.icon;
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            title={o.title || (typeof o.label === 'string' ? o.label : undefined)}
            onClick={() => onChange(o.value)}
            className={cx(
              'inline-flex flex-1 items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap transition-colors',
              size === 'sm' ? 'h-7 px-2 text-xs' : 'h-8 px-3 text-[13px]',
              active ? 'bg-ink-700 text-white shadow-sm' : 'text-ink-300 hover:text-white',
            )}
          >
            {Icon && <Icon className="size-4" />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function toHex(color) {
  if (!color) return '#000000';
  if (color.startsWith('#')) return color.length === 4 ? `#${[...color.slice(1)].map((c) => c + c).join('')}` : color.slice(0, 7);
  const m = color.match(/rgba?\(([^)]+)\)/);
  if (!m) return '#000000';
  const [r, g, b] = m[1].split(',').map((x) => parseInt(x, 10));
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

function alphaOf(color) {
  const m = color?.match(/rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)/);
  return m ? parseFloat(m[1]) : 1;
}

/** Color swatch + hex input. Preserves alpha if the stored value is rgba(). */
export function ColorField({ label, value, onChange }) {
  const hex = toHex(value);
  const alpha = alphaOf(value);
  const [text, setText] = useState(value || '');
  useEffect(() => setText(value || ''), [value]);
  const fromHex = (h) => {
    if (alpha >= 1) return h;
    const n = parseInt(h.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
  };
  return (
    <div>
      {label && <span className="label">{label}</span>}
      <div className="flex items-center gap-2">
        <label className="relative size-10 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-ink-600 checker">
          <span className="absolute inset-0" style={{ background: value }} />
          <input
            type="color"
            value={hex}
            onChange={(e) => onChange(fromHex(e.target.value))}
            className="absolute inset-0 cursor-pointer opacity-0"
            aria-label={label || 'Color'}
          />
        </label>
        <input
          className="input font-mono text-[13px]"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(text) || /^rgba?\(/.test(text) ? onChange(text) : setText(value))}
          spellCheck={false}
        />
      </div>
    </div>
  );
}

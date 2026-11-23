import { useEffect, useMemo, useRef, useState } from 'react';
import { FileType2, Loader2, Plus, Trash2, Upload, X } from 'lucide-react';
import {
  FONT_ACCEPT,
  FONT_EXTENSIONS,
  FONT_MAX_MB,
  FONT_NAME_PATTERN,
  FONT_WEIGHT_NAMES,
  FONT_WEIGHT_OPTIONS,
  guessFontVariant,
  isBuiltInFontName,
  variantKey,
  variantLabel,
} from '@shared/engine/fonts.js';
import { fontsApi, errorMessage } from '../../lib/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { loadCustomFonts, setCustomFonts, useCustomFonts } from '../../hooks/useCustomFonts.js';
import { Button } from '../../components/ui/Button.jsx';
import { Field, Input, Select } from '../../components/ui/Fields.jsx';
import { ConfirmDialog } from '../../components/ui/Modal.jsx';
import { cx } from '../../lib/utils.js';

const SAMPLE = 'The quick brown fox jumps over the lazy dog';
const WEIGHT_SELECT = FONT_WEIGHT_OPTIONS.map((w) => ({ value: w, label: `${w} · ${FONT_WEIGHT_NAMES[w]}` }));
const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(bytes < 1024 * 1024 ? 2 : 1)} MB`;
const fontCss = (family, weight = 400, style = 'normal') => ({ fontFamily: `'${family}', 'Inter Variable'`, fontWeight: weight, fontStyle: style });

function checkFontFile(file) {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (!FONT_EXTENSIONS.includes(ext)) return `${file.name}: use WOFF2, WOFF, TTF or OTF font files.`;
  if (file.size > FONT_MAX_MB * 1024 * 1024) return `${file.name} is larger than ${FONT_MAX_MB} MB.`;
  return '';
}

/**
 * Settings → Fonts: upload font files (one per weight / italic) that then appear in the
 * builder's Typography list and load on the client site and desktop app.
 */
export default function FontSettings({ canEdit }) {
  const toast = useToast();
  const fonts = useCustomFonts();
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState(null); // { family, lockedFamily, items: [{ id, file, weight, style }] }
  const [progress, setProgress] = useState(null);
  const [confirm, setConfirm] = useState(null); // font to delete
  const [busy, setBusy] = useState('');
  const fileRef = useRef(null);
  const familyRef = useRef(null);

  // Fresh list (with "used in N stories") whenever the card opens.
  useEffect(() => {
    loadCustomFonts({ force: true }).finally(() => setLoaded(true));
    // Opened from the builder's "Upload it in Settings → Fonts" link.
    if (window.location.hash === '#fonts') setTimeout(() => document.getElementById('fonts')?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, []);

  const pickFiles = (family) => {
    fileRef.current.dataset.family = family || '';
    fileRef.current.click();
  };

  const onFiles = (list) => {
    const files = [...list];
    const bad = files.map(checkFontFile).filter(Boolean);
    if (bad.length) toast.error(bad[0]);
    const ok = files.filter((f) => !checkFontFile(f));
    if (!ok.length) return;
    const lockedFamily = fileRef.current.dataset.family || '';
    const items = ok.map((file) => {
      const g = guessFontVariant(file.name);
      return { id: `${file.name}-${file.size}-${Math.random()}`, file, weight: g.weight, style: g.style };
    });
    setDraft((d) => {
      // Picking more files while a draft is open adds to it.
      if (d && (!lockedFamily || lockedFamily === d.lockedFamily)) return { ...d, items: [...d.items, ...items] };
      return { family: lockedFamily || guessFontVariant(ok[0].name).family, lockedFamily, items };
    });
    setTimeout(() => familyRef.current?.focus(), 0);
  };

  const family = draft?.family.trim().replace(/\s+/g, ' ') || '';
  const existing = fonts.find((f) => f.family.toLowerCase() === family.toLowerCase());
  const draftIssues = useMemo(() => {
    if (!draft) return [];
    const out = [];
    if (!family) out.push('Give the font a name.');
    else if (!FONT_NAME_PATTERN.test(family)) out.push('Font names can use letters, numbers, spaces, - and _ (up to 60 characters).');
    else if (isBuiltInFontName(family)) out.push(`"${family}" is already a built-in font. Choose another name.`);
    const keys = draft.items.map((i) => variantKey(i.weight, i.style));
    const dup = draft.items.find((i, n) => keys.indexOf(variantKey(i.weight, i.style)) !== n);
    if (dup) out.push(`Two files are set to ${variantLabel(dup)}. Give each file a different weight or style.`);
    if (!draft.items.length) out.push('Add at least one font file.');
    return out;
  }, [draft, family]);
  const replacing = (item) => existing?.files.some((f) => f.key === variantKey(item.weight, item.style));

  const setItem = (id, patch) => setDraft((d) => ({ ...d, items: d.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) }));
  const removeItem = (id) => setDraft((d) => ({ ...d, items: d.items.filter((i) => i.id !== id) }));

  const upload = async () => {
    if (draftIssues.length) return toast.error(draftIssues[0]);
    setProgress(0);
    try {
      const font = await fontsApi.upload(family, draft.items, setProgress);
      setCustomFonts([...fonts.filter((f) => f.id !== font.id), { ...font, usedBy: existing?.usedBy ?? 0 }]);
      setDraft(null);
      toast.success(`${font.family} is ready. Pick it under Typography in the story builder.`);
    } catch (e) {
      toast.error(errorMessage(e, 'Could not upload the font.'));
    } finally {
      setProgress(null);
    }
  };

  const removeFile = async (font, key) => {
    setBusy(`${font.id}/${key}`);
    try {
      const next = await fontsApi.removeFile(font.id, key);
      setCustomFonts(next ? fonts.map((f) => (f.id === font.id ? { ...next, usedBy: f.usedBy } : f)) : fonts.filter((f) => f.id !== font.id));
    } catch (e) {
      toast.error(errorMessage(e, 'Could not remove that weight.'));
    } finally {
      setBusy('');
    }
  };

  const removeFont = async () => {
    const font = confirm;
    setBusy(font.id);
    try {
      await fontsApi.remove(font.id);
      setCustomFonts(fonts.filter((f) => f.id !== font.id));
      toast.success(`${font.family} deleted.`);
      setConfirm(null);
    } catch (e) {
      toast.error(errorMessage(e, 'Could not delete the font.'));
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="space-y-5">
      <input
        ref={fileRef}
        type="file"
        multiple
        accept={FONT_ACCEPT}
        className="hidden"
        onChange={(e) => { if (e.target.files?.length) onFiles(e.target.files); e.target.value = ''; }}
      />

      {canEdit && !draft && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-ink-600 bg-ink-900/40 p-4">
          <Button variant="primary" icon={Upload} onClick={() => pickFiles('')}>Upload font files</Button>
          <p className="min-w-0 flex-1 text-xs leading-relaxed text-ink-400">
            WOFF2 (best), WOFF, TTF or OTF, up to {FONT_MAX_MB} MB each. Pick all the weights of a font at once, e.g.
            Geometria-Regular and Geometria-Bold. Only upload fonts you are licensed to use on the web.
          </p>
        </div>
      )}

      {/* New upload: name the font and check each file's weight. */}
      {draft && (
        <div className="space-y-4 rounded-xl border border-[#6366f1]/40 bg-ink-900/60 p-4">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <Field label="Font name" htmlFor="font-family" hint={existing ? `Adds to your existing font “${existing.family}”.` : 'This is the name shown in the Typography list.'}>
              <Input
                id="font-family"
                ref={familyRef}
                value={draft.family}
                maxLength={60}
                disabled={Boolean(draft.lockedFamily)}
                placeholder="e.g. Geometria"
                onChange={(e) => setDraft((d) => ({ ...d, family: e.target.value }))}
              />
            </Field>
            <div>
              <span className="label">Preview</span>
              <div className="truncate rounded-lg border border-ink-700 bg-ink-950/60 px-3 py-2 text-xl text-white" style={fontCss(family || 'Inter Variable')}>
                {family || 'Font name'} · Aa 123
              </div>
            </div>
          </div>

          <ul className="space-y-2">
            {draft.items.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-ink-700 bg-ink-900 p-2.5">
                <FileType2 className="size-4 shrink-0 text-ink-400" />
                <span className="min-w-0 flex-1 truncate text-sm text-white" title={item.file.name}>
                  {item.file.name} <span className="text-xs text-ink-500">{mb(item.file.size)}</span>
                </span>
                <Select className="h-8 w-44 py-0 text-[13px]" value={item.weight} onChange={(v) => setItem(item.id, { weight: Number(v) })} options={WEIGHT_SELECT} aria-label={`${item.file.name} weight`} />
                <label className="flex h-8 items-center gap-1.5 rounded-lg border border-ink-700 px-2.5 text-[13px] text-ink-200">
                  <input type="checkbox" className="size-3.5 accent-[#6366f1]" checked={item.style === 'italic'} onChange={(e) => setItem(item.id, { style: e.target.checked ? 'italic' : 'normal' })} />
                  Italic
                </label>
                {replacing(item) && <span className="text-xs text-amber-300">replaces current</span>}
                <Button size="icon-sm" variant="ghost" onClick={() => removeItem(item.id)} aria-label={`Remove ${item.file.name}`} title="Remove"><X className="size-4" /></Button>
              </li>
            ))}
          </ul>
          <p className="hint -mt-1">The weight and italic were guessed from each file name. Check them before uploading.</p>

          {draftIssues.length > 0 && draft.items.length > 0 && <p className="text-xs text-rose-300">{draftIssues[0]}</p>}
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" icon={progress !== null ? Loader2 : Upload} disabled={progress !== null || draftIssues.length > 0} onClick={upload}>
              {progress !== null ? `Uploading ${progress}%` : `Upload ${draft.items.length} file${draft.items.length === 1 ? '' : 's'}`}
            </Button>
            <Button variant="ghost" icon={Plus} disabled={progress !== null} onClick={() => pickFiles(draft.lockedFamily)}>Add more files</Button>
            <Button variant="ghost" className="ml-auto" disabled={progress !== null} onClick={() => setDraft(null)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Uploaded fonts */}
      {!loaded && !fonts.length ? (
        <div className="flex items-center gap-2 text-sm text-ink-400"><Loader2 className="size-4 animate-spin" /> Loading fonts…</div>
      ) : fonts.length === 0 ? (
        <p className="text-sm text-ink-400">No fonts uploaded yet. The built-in fonts (Inter, Playfair Display, Montserrat…) are always available.</p>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {fonts.map((font) => (
            <li key={font.id} className="flex flex-col gap-3 rounded-xl border border-ink-700 bg-ink-900/60 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-2xl text-white" style={fontCss(font.family, font.files.some((f) => f.weight === 400) ? 400 : font.files[0]?.weight)}>{font.family}</div>
                  <div className="mt-0.5 text-xs text-ink-400">
                    {font.files.length} {font.files.length === 1 ? 'style' : 'styles'}
                    {typeof font.usedBy === 'number' && ` · ${font.usedBy ? `used in ${font.usedBy} ${font.usedBy === 1 ? 'story' : 'stories'}` : 'not used yet'}`}
                  </div>
                </div>
                {canEdit && (
                  <div className="flex shrink-0 gap-1">
                    <Button size="sm" variant="ghost" icon={Plus} onClick={() => { setDraft(null); pickFiles(font.family); }}>Add weights</Button>
                    <Button size="icon-sm" variant="danger-ghost" onClick={() => setConfirm(font)} aria-label={`Delete ${font.family}`} title="Delete font"><Trash2 className="size-4" /></Button>
                  </div>
                )}
              </div>
              <ul className="space-y-1.5">
                {font.files.map((f) => (
                  <li key={f.key} className="flex items-center gap-3 rounded-lg bg-ink-950/50 px-3 py-1.5">
                    <span className="w-28 shrink-0 text-xs text-ink-400">{variantLabel(f)}</span>
                    <span className="min-w-0 flex-1 truncate text-[15px] text-ink-100" style={fontCss(font.family, f.weight, f.style)}>{SAMPLE}</span>
                    {canEdit && (
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        className="size-6"
                        disabled={busy === `${font.id}/${f.key}`}
                        onClick={() => (font.files.length === 1 ? setConfirm(font) : removeFile(font, f.key))}
                        aria-label={`Remove ${font.family} ${variantLabel(f)}`}
                        title="Remove this weight"
                      >
                        <X className="size-3.5" />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
      {!canEdit && <p className="text-xs text-ink-400">Only administrators can upload or delete fonts.</p>}

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm ? `Delete ${confirm.family}?` : ''}
        description={
          confirm?.usedBy
            ? `${confirm.usedBy} ${confirm.usedBy === 1 ? 'story uses' : 'stories use'} this font. Their text will show in Inter instead until you pick another font or upload it again.`
            : 'The font files are removed. No story uses this font.'
        }
        confirmLabel="Delete font"
        tone="danger"
        loading={Boolean(confirm) && busy === confirm.id}
        onConfirm={removeFont}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}

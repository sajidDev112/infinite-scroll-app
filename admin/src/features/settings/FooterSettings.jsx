import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Eye, EyeOff, ImageUp, Loader2, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { FOOTER_BUTTON_TYPES, FOOTER_MAX_BUTTONS, footerIssues, footerType, normalizeFooter } from '@shared/engine/footer.js';
import { DEFAULT_LOGO_URL, IntroFooter } from '@shared/react/IntroFooter.jsx';
import { settingsApi, uploadsApi, errorMessage } from '../../lib/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { setFooterSettings } from '../../hooks/useFooterSettings.js';
import { Button } from '../../components/ui/Button.jsx';
import { Field, Input, Select, Toggle } from '../../components/ui/Fields.jsx';
import { ConfirmDialog } from '../../components/ui/Modal.jsx';
import { ACCEPT, checkFile } from '../builder/useUploadQueue.js';
import { cx } from '../../lib/utils.js';

const MODE_LABELS = { action: 'Built-in action', share: 'Share this story', link: 'Open my link' };
const URL_PLACEHOLDERS = {
  facebook: 'https://www.facebook.com/your-page',
  x: 'https://x.com/your-account',
  whatsapp: 'https://wa.me/911234567890',
  linkedin: 'https://www.linkedin.com/company/your-company',
  instagram: 'https://www.instagram.com/your-account',
  youtube: 'https://www.youtube.com/@your-channel',
  website: 'https://www.your-website.org',
  email: 'hello@your-website.org',
};
const ACTION_HINTS = {
  like: 'Visitors can like the story (saved on their device).',
  copyLink: "Copies the story's link.",
  share: "Opens the device's share menu (or copies the link on computers).",
};

/**
 * Settings → "Story intro footer": the share / social buttons, logo and name shown at the
 * bottom of every story's intro screen. Admins can change it; editors see it read-only.
 */
export default function FooterSettings({ canEdit }) {
  const toast = useToast();
  const [saved, setSaved] = useState(null);
  const [draft, setDraft] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [addType, setAddType] = useState('instagram');
  const fileRef = useRef(null);

  useEffect(() => {
    settingsApi.getFooter()
      .then((f) => { setSaved(f); setDraft(f); })
      .catch((e) => setLoadError(errorMessage(e, 'Could not load the footer settings.')));
  }, []);

  const footer = useMemo(() => (draft ? normalizeFooter(draft) : null), [draft]);
  const issues = useMemo(() => (footer ? footerIssues(footer) : []), [footer]);
  const issueAt = (i) => issues.find((x) => x.index === i)?.message;
  const dirty = draft && saved && JSON.stringify(normalizeFooter(draft)) !== JSON.stringify(normalizeFooter(saved));

  if (loadError) return <p className="text-sm text-rose-300">{loadError}</p>;
  if (!footer) return <div className="flex items-center gap-2 text-sm text-ink-400"><Loader2 className="size-4 animate-spin" /> Loading…</div>;

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const setButton = (i, patch) => set({ buttons: footer.buttons.map((b, k) => (k === i ? { ...b, ...patch } : b)) });
  const moveButton = (i, dir) => {
    const list = [...footer.buttons];
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    set({ buttons: list });
  };
  const removeButton = (i) => set({ buttons: footer.buttons.filter((_, k) => k !== i) });
  const addButton = () => {
    const t = footerType(addType);
    set({ buttons: [...footer.buttons, { type: t.type, enabled: true, mode: t.modes.includes('link') ? 'link' : t.modes[0], url: '' }] });
  };

  const uploadLogo = async (file) => {
    const err = checkFile(file);
    if (err) return toast.error(err);
    setUploading(0);
    try {
      const img = await uploadsApi.upload(file, setUploading, undefined, { scope: 'footer' });
      set({ logo: { imageId: img.id, url: img.url }, showLogo: true });
    } catch (e) {
      toast.error(errorMessage(e, 'Logo upload failed.'));
    } finally {
      setUploading(null);
    }
  };

  const save = async () => {
    if (issues.length) return toast.error(issues[0].message);
    setSaving(true);
    try {
      const next = await settingsApi.saveFooter(footer);
      setSaved(next);
      setDraft(next);
      setFooterSettings(next);
      toast.success('Footer saved. It now shows on every story.');
    } catch (e) {
      toast.error(errorMessage(e, 'Could not save the footer.'));
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    setSaving(true);
    try {
      const next = await settingsApi.resetFooter();
      setSaved(next);
      setDraft(next);
      setFooterSettings(next);
      toast.success('Footer reset to the default.');
    } catch (e) {
      toast.error(errorMessage(e, 'Could not reset the footer.'));
    } finally {
      setSaving(false);
      setConfirmReset(false);
    }
  };

  const disabled = !canEdit;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      {/* Editor */}
      <div className="space-y-6">
        <div className="space-y-4">
          <h3 className="text-[13px] font-semibold uppercase tracking-wide text-ink-400">Logo &amp; name</h3>
          <div className="flex flex-wrap items-center gap-4">
            {/* Fixed box; any logo shape (tall, wide, square) is fitted inside without overflowing. */}
            <div className="flex h-24 w-36 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-ink-700 bg-[radial-gradient(circle_at_30%_20%,#3b3b46,#111116)] p-3 sm:w-44">
              <img src={footer.logo?.url || DEFAULT_LOGO_URL} alt="Logo" className={cx('block h-full w-full object-contain', !footer.showLogo && 'opacity-30')} draggable={false} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" icon={uploading !== null ? Loader2 : ImageUp} disabled={disabled || uploading !== null} onClick={() => fileRef.current?.click()}>
                {uploading !== null ? `Uploading ${uploading}%` : 'Upload logo'}
              </Button>
              {footer.logo && (
                <Button size="sm" variant="ghost" icon={RotateCcw} disabled={disabled} onClick={() => set({ logo: null })}>Use default logo</Button>
              )}
            </div>
            <input ref={fileRef} type="file" accept={ACCEPT} className="hidden" onChange={(e) => { if (e.target.files?.[0]) uploadLogo(e.target.files[0]); e.target.value = ''; }} />
          </div>
          <p className="hint -mt-2">PNG with a transparent background works best (white or light logo, it sits on the story image).</p>
          <Toggle id="ft-logo" label="Show logo" checked={footer.showLogo} onChange={(v) => !disabled && set({ showLogo: v })} />
          <Field label="Name under the logo" htmlFor="ft-name">
            <Input id="ft-name" value={footer.brandName} maxLength={80} disabled={disabled} placeholder="e.g. Museum of Art & Photography" onChange={(e) => set({ brandName: e.target.value })} />
          </Field>
          <Toggle id="ft-name-on" label="Show name" checked={footer.showBrandName} onChange={(v) => !disabled && set({ showBrandName: v })} />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-[13px] font-semibold uppercase tracking-wide text-ink-400">Buttons ({footer.buttons.length})</h3>
            <span className="text-xs text-ink-500">Shown left to right</span>
          </div>
          <ul className="space-y-2">
            {footer.buttons.map((b, i) => {
              const t = footerType(b.type);
              const err = issueAt(i);
              return (
                <li key={`${b.type}-${i}`} className={cx('rounded-xl border bg-ink-900/60 p-3', err ? 'border-rose-500/50' : 'border-ink-700', !b.enabled && 'border-dashed bg-ink-900/30')}>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={b.enabled}
                      aria-label={`${b.enabled ? 'Hide' : 'Show'} ${t.label}`}
                      title={b.enabled ? 'Shown — click to hide' : 'Hidden — click to show'}
                      disabled={disabled}
                      onClick={() => setButton(i, { enabled: !b.enabled })}
                      className={cx(
                        'flex h-8 w-[5.5rem] shrink-0 items-center justify-center gap-1.5 rounded-lg border text-xs font-medium transition-colors disabled:cursor-not-allowed',
                        b.enabled
                          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                          : 'border-ink-600 bg-ink-800 text-ink-400 hover:text-ink-200',
                      )}
                    >
                      {b.enabled ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                      {b.enabled ? 'Shown' : 'Hidden'}
                    </button>
                    <span className={cx('w-28 text-sm font-medium', b.enabled ? 'text-white' : 'text-ink-400 line-through decoration-ink-500')}>{t.label}</span>
                    {t.modes.length > 1 ? (
                      <Select className="h-8 min-w-0 flex-1 py-0 text-[13px]" value={b.mode} disabled={disabled} onChange={(v) => setButton(i, { mode: v })} options={t.modes.map((m) => ({ value: m, label: MODE_LABELS[m] }))} aria-label={`${t.label} behaviour`} />
                    ) : (
                      <span className="min-w-0 flex-1 truncate text-xs text-ink-400">{b.mode === 'link' ? MODE_LABELS.link : ACTION_HINTS[b.type]}</span>
                    )}
                    <div className="flex shrink-0 gap-0.5">
                      <Button size="icon-sm" variant="ghost" disabled={disabled || i === 0} onClick={() => moveButton(i, -1)} aria-label="Move left" title="Move left"><ArrowUp className="size-4" /></Button>
                      <Button size="icon-sm" variant="ghost" disabled={disabled || i === footer.buttons.length - 1} onClick={() => moveButton(i, 1)} aria-label="Move right" title="Move right"><ArrowDown className="size-4" /></Button>
                      <Button size="icon-sm" variant="danger-ghost" disabled={disabled} onClick={() => removeButton(i)} aria-label={`Remove ${t.label}`} title="Remove"><Trash2 className="size-4" /></Button>
                    </div>
                  </div>
                  {b.mode === 'link' && (
                    <div className="mt-2">
                      <Input
                        value={b.url}
                        disabled={disabled}
                        placeholder={URL_PLACEHOLDERS[b.type]}
                        error={err}
                        className="h-9 text-[13px]"
                        onChange={(e) => setButton(i, { url: e.target.value })}
                        aria-label={`${t.label} link`}
                      />
                      {err && <p className="mt-1 text-xs text-rose-300">{err}</p>}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {canEdit && footer.buttons.length < FOOTER_MAX_BUTTONS && (
            <div className="flex gap-2">
              <Select className="h-9 min-w-0 flex-1 py-0 text-[13px]" value={addType} onChange={setAddType} options={FOOTER_BUTTON_TYPES.map((t) => ({ value: t.type, label: t.label }))} aria-label="Button to add" />
              <Button size="sm" icon={Plus} onClick={addButton} className="h-9">Add button</Button>
            </div>
          )}
        </div>

        {canEdit ? (
          <div className="flex flex-wrap items-center gap-3 border-t border-ink-700/60 pt-5">
            <Button variant="primary" loading={saving} disabled={!dirty} onClick={save}>Save footer</Button>
            {dirty && <Button variant="ghost" onClick={() => setDraft(saved)}>Discard changes</Button>}
            <Button variant="ghost" icon={RotateCcw} className="ml-auto" disabled={saving} onClick={() => setConfirmReset(true)}>Reset to default</Button>
          </div>
        ) : (
          <p className="text-xs text-ink-400">Only administrators can change the footer.</p>
        )}
      </div>

      {/* Live preview, drawn by the same component the stories use. */}
      <div className="xl:sticky xl:top-6 xl:self-start">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[13px] font-medium text-ink-200">Preview</span>
          {dirty && <span className="text-xs text-amber-300">Unsaved changes</span>}
        </div>
        <div
          className="relative aspect-[16/10] w-full overflow-hidden rounded-xl border border-ink-700 bg-[linear-gradient(160deg,#4a4036_0%,#2a2520_45%,#121014_100%)]"
          style={{ '--u': '0.62px' }}
        >
          <div className="absolute inset-x-0 top-[22%] text-center font-['Playfair_Display_Variable',serif] text-3xl text-white/90">Story title</div>
          <IntroFooter interactive={false} title="Story title" author="Author name" footer={footer} />
        </div>
        <p className="hint">Shown at the bottom of every story's first screen, in the client site, desktop app and previews. Buttons set to “Open my link” without a link are hidden.</p>
      </div>

      <ConfirmDialog
        open={confirmReset}
        title="Reset the footer?"
        description="The buttons, logo and name go back to the original MAP footer."
        confirmLabel="Reset footer"
        tone="danger"
        loading={saving}
        onConfirm={reset}
        onClose={() => setConfirmReset(false)}
      />
    </div>
  );
}


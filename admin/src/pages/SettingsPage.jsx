import { useState } from 'react';
import { authApi, errorDetails, errorMessage, API_URL } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Field, Input, RangeField, Select, Toggle } from '../components/ui/Fields.jsx';
import { PageHeader } from '../components/ui/Misc.jsx';
import { loadPrefs, savePrefs } from '../lib/utils.js';
import { STAGE_ASPECTS } from '@shared/engine/constants.js';
import FooterSettings from '../features/settings/FooterSettings.jsx';
import FontSettings from '../features/settings/FontSettings.jsx';

function Section({ id, title, description, children, className }) {
  return (
    <section id={id} className={`card flex scroll-mt-6 flex-col gap-6 p-6 ${className || ''}`}>
      <div className="border-b border-ink-700/60 pb-4">
        <h2 className="text-[15px] font-semibold text-white">{title}</h2>
        <p className="mt-1 text-sm text-ink-400">{description}</p>
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

export default function SettingsPage() {
  const { admin, setAdmin } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(admin?.name || '');
  const [savingName, setSavingName] = useState(false);
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [pwErrors, setPwErrors] = useState({});
  const [savingPw, setSavingPw] = useState(false);
  const [prefs, setPrefs] = useState(loadPrefs);

  const saveName = async (e) => {
    e.preventDefault();
    if (!name.trim()) return toast.error('Name is required.');
    setSavingName(true);
    try {
      setAdmin(await authApi.updateProfile({ name: name.trim() }));
      toast.success('Profile updated.');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSavingName(false);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!pw.currentPassword) errs.currentPassword = 'Enter your current password.';
    if (pw.newPassword.length < 8) errs.newPassword = 'Use at least 8 characters.';
    if (pw.confirm !== pw.newPassword) errs.confirm = 'Passwords do not match.';
    setPwErrors(errs);
    if (Object.keys(errs).length) return;
    setSavingPw(true);
    try {
      await authApi.changePassword({ currentPassword: pw.currentPassword, newPassword: pw.newPassword });
      setPw({ currentPassword: '', newPassword: '', confirm: '' });
      toast.success('Password changed.');
    } catch (err) {
      const d = Object.fromEntries(errorDetails(err).map((x) => [x.path, x.message]));
      setPwErrors(d);
      if (!Object.keys(d).length) toast.error(errorMessage(err));
    } finally {
      setSavingPw(false);
    }
  };

  const setPref = (k, v) => {
    const next = { ...prefs, [k]: v };
    setPrefs(next);
    savePrefs(next);
  };

  return (
    <>
      <PageHeader title="Settings" description="Your account, editor preferences, the story footer and fonts." />
      {/* Two cards per row on wide screens, one per row on narrow ones. */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Section
          className="lg:col-span-2"
          title="Story intro footer"
          description="The share and social buttons, logo and name at the bottom of every story's first screen."
        >
          <FooterSettings canEdit={admin?.role === 'admin'} />
        </Section>

        <Section
          id="fonts"
          className="lg:col-span-2"
          title="Fonts"
          description="Upload your own fonts (e.g. Geometria). They appear in the story builder's Typography list and load on the client site and desktop app."
        >
          <FontSettings canEdit={admin?.role === 'admin'} />
        </Section>

        <Section title="Profile" description="How your name appears in the dashboard.">
          <form onSubmit={saveName} className="space-y-5">
            <Field label="Name" htmlFor="name"><Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} /></Field>
            <Field label="Email" hint="Contact another admin to change your email."><Input value={admin?.email || ''} disabled /></Field>
            <Field label="Role"><Input value={admin?.role === 'admin' ? 'Administrator' : 'Editor'} disabled /></Field>
            <Button type="submit" variant="primary" loading={savingName}>Save profile</Button>
          </form>
        </Section>

        <Section title="Password" description="Use a long, unique password.">
          <form onSubmit={savePassword} className="space-y-5" noValidate>
            <Field label="Current password" htmlFor="cpw" error={pwErrors.currentPassword}>
              <Input id="cpw" type="password" autoComplete="current-password" value={pw.currentPassword} error={pwErrors.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} />
            </Field>
            <Field label="New password" htmlFor="npw" error={pwErrors.newPassword} hint="At least 8 characters.">
              <Input id="npw" type="password" autoComplete="new-password" value={pw.newPassword} error={pwErrors.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} />
            </Field>
            <Field label="Confirm new password" htmlFor="rpw" error={pwErrors.confirm}>
              <Input id="rpw" type="password" autoComplete="new-password" value={pw.confirm} error={pwErrors.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
            </Field>
            <Button type="submit" variant="primary" loading={savingPw}>Change password</Button>
          </form>
        </Section>

        <Section title="Story Builder" description="Stored in this browser.">
          <Toggle id="autosave" label="Autosave drafts" description="Save changes automatically while you edit." checked={prefs.autosave} onChange={(v) => setPref('autosave', v)} />
          <RangeField label="Autosave delay" value={prefs.autosaveDelay} onChange={(v) => setPref('autosaveDelay', v)} min={1} max={15} step={1} suffix="s" hint="Seconds of inactivity before saving." />
          <Field label="Default preview screen shape" hint="Aspect ratio of the editor stage. The desktop viewer adapts to any screen.">
            <Select value={prefs.stageAspect} onChange={(v) => setPref('stageAspect', Number(v))} options={STAGE_ASPECTS} />
          </Field>
        </Section>

        <Section title="Connection" description="Where this dashboard sends requests.">
          <Field label="API endpoint"><Input value={API_URL} disabled className="font-mono text-[13px]" /></Field>
        </Section>
      </div>
    </>
  );
}

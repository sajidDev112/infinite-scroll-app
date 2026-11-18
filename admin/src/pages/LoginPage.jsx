import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { errorMessage } from '../lib/api.js';
import { Button } from '../components/ui/Button.jsx';
import { Field } from '../components/ui/Fields.jsx';
import { Brand } from '../components/layout/AppLayout.jsx';
import { cx } from '../lib/utils.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '', remember: true });
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const e = {};
    if (!form.email.trim()) e.email = 'Email is required.';
    else if (!EMAIL_RE.test(form.email.trim())) e.email = 'Enter a valid email address.';
    if (!form.password) e.password = 'Password is required.';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    setFormError('');
    if (!validate()) return;
    setLoading(true);
    try {
      await login({ email: form.email.trim(), password: form.password, remember: form.remember });
      navigate(location.state?.from || '/', { replace: true });
    } catch (err) {
      setFormError(errorMessage(err, 'Sign-in failed.'));
    } finally {
      setLoading(false);
    }
  };

  const set = (k) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((x) => ({ ...x, [k]: undefined }));
  };

  return (
    <div className="relative grid min-h-full lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden overflow-hidden lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(99,102,241,0.28),transparent_55%),radial-gradient(ellipse_at_80%_90%,rgba(139,92,246,0.22),transparent_50%)]" />
        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '64px 64px' }} />
        <div className="relative flex h-full flex-col justify-between p-12">
          <Brand />
          <div className="max-w-lg">
            <p className="section-title text-accent-300">Scroll-driven storytelling</p>
            <h1 className="mt-4 font-display text-5xl leading-[1.05] font-medium text-white">
              Frame every moment.
              <br />
              <span className="italic text-ink-200">Let the scroll tell it.</span>
            </h1>
            <p className="mt-6 text-[15px] leading-relaxed text-ink-300">
              Build cinematic stories with focal-point zoom, animated typography and seamless scene transitions,
              then publish them straight to the desktop viewer.
            </p>
          </div>
          <p className="text-xs text-ink-500">© {new Date().getFullYear()} Storyframe</p>
        </div>
      </div>

      <div className="flex items-center justify-center px-6 py-12">
        <form onSubmit={submit} noValidate className="w-full max-w-sm">
          <Brand className="mb-10 lg:hidden" />
          <h2 className="text-2xl font-semibold tracking-tight text-white">Sign in</h2>
          <p className="mt-1.5 text-sm text-ink-400">Use your admin account to manage stories.</p>

          {formError && (
            <div role="alert" className="mt-6 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {formError}
            </div>
          )}

          <div className="mt-8 space-y-5">
            <Field label="Email" htmlFor="email" error={errors.email}>
              <div className="relative">
                <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-400" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  className={cx('input h-11 pl-10', errors.email && 'input-error')}
                  placeholder="you@company.com"
                  value={form.email}
                  onChange={set('email')}
                />
              </div>
            </Field>
            <Field label="Password" htmlFor="password" error={errors.password}>
              <div className="relative">
                <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-400" />
                <input
                  id="password"
                  type={show ? 'text' : 'password'}
                  autoComplete="current-password"
                  className={cx('input h-11 pr-11 pl-10', errors.password && 'input-error')}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={set('password')}
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1.5 text-ink-400 hover:text-white"
                  aria-label={show ? 'Hide password' : 'Show password'}
                >
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </Field>
            <label className="flex cursor-pointer items-center gap-2.5 text-sm text-ink-200 select-none">
              <input type="checkbox" checked={form.remember} onChange={set('remember')} className="size-4 rounded accent-accent-500" />
              Remember me for 30 days
            </label>
          </div>

          <Button type="submit" variant="primary" size="lg" loading={loading} className="mt-8 w-full justify-center">
            Sign in
          </Button>
        </form>
      </div>
    </div>
  );
}

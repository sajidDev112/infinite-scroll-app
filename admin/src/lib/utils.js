export const cx = (...c) => c.filter(Boolean).join(' ');

export function formatDate(iso, opts = { dateStyle: 'medium' }) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat(undefined, opts).format(new Date(iso));
}

export function timeAgo(iso) {
  if (!iso) return '—';
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 45) return 'just now';
  const units = [[60, 'minute'], [3600, 'hour'], [86400, 'day'], [604800, 'week'], [2629800, 'month'], [31557600, 'year']];
  let [div, name] = units[0];
  for (const u of units) if (s >= u[0]) [div, name] = u;
  const n = Math.round(s / div);
  return new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(-n, name);
}

export const pct = (v) => `${Math.round((v ?? 0) * 100)}%`;

export function formatBytes(b) {
  if (!b) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(u.length - 1, Math.floor(Math.log(b) / Math.log(1024)));
  return `${(b / 1024 ** i).toFixed(i ? 1 : 0)} ${u[i]}`;
}

const PREFS_KEY = 'sf_prefs';
export const DEFAULT_PREFS = { autosave: true, autosaveDelay: 3, stageAspect: 16 / 9 };

export function loadPrefs() {
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function savePrefs(p) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(p));
}

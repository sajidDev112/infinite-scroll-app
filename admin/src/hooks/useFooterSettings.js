import { useEffect, useState } from 'react';
import { settingsApi } from '../lib/api.js';

// Loaded once per page load and shared; Settings updates it after saving.
let cached = null;
let pending = null;
const listeners = new Set();

export function setFooterSettings(footer) {
  cached = footer;
  listeners.forEach((fn) => fn(footer));
}

/** The intro footer settings (null until loaded; the player then shows the defaults). */
export function useFooterSettings() {
  const [footer, setFooter] = useState(cached);
  useEffect(() => {
    listeners.add(setFooter);
    if (!cached) {
      pending ||= settingsApi.getFooter().then(setFooterSettings).catch(() => {}).finally(() => { pending = null; });
    }
    return () => listeners.delete(setFooter);
  }, []);
  return footer;
}

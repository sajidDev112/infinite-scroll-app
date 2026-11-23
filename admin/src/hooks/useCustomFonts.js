import { useEffect, useState } from 'react';
import { initCustomFonts, installFonts } from '@shared/react/customFonts.js';
import { fontsApi } from '../lib/api.js';

// Loaded once after sign-in and shared; Settings → Fonts updates it after each change.
let cached = null;
let pending = null;
let version = 0; // bumps on every change, so an older request can't overwrite a newer list
const listeners = new Set();

/** Replaces the font list everywhere in the dashboard and registers the fonts with the browser. */
export function setCustomFonts(fonts) {
  version++;
  cached = fonts;
  installFonts(fonts);
  listeners.forEach((fn) => fn(fonts));
}

export function loadCustomFonts({ force = false } = {}) {
  if (cached && !force) return Promise.resolve(cached);
  if (pending && !force) return pending;
  const started = version;
  const request = fontsApi.list()
    .then((fonts) => {
      if (version === started) setCustomFonts(fonts);
      return cached;
    })
    .catch(() => cached || [])
    .finally(() => { if (pending === request) pending = null; });
  pending = request;
  initCustomFonts(() => request); // the story preview waits for this before measuring text
  return request;
}

/** The uploaded fonts ([] until loaded). */
export function useCustomFonts() {
  const [fonts, setFonts] = useState(cached || []);
  useEffect(() => {
    listeners.add(setFonts);
    if (cached) setFonts(cached); // loaded between render and now
    else loadCustomFonts();
    return () => listeners.delete(setFonts);
  }, []);
  return fonts;
}

import { FONT_FORMATS, storyFontUses } from '../engine/fonts.js';

/**
 * Registers the fonts uploaded in admin Settings with the browser (FontFace API).
 * The files only download when text actually uses them (or `loadStoryFonts` asks).
 */
const installed = new Map(); // `${family}|${key}|${url}` -> FontFace
let installing = null;

export function installFonts(fonts = []) {
  if (typeof document === 'undefined' || !document.fonts || typeof FontFace === 'undefined') return;
  const wanted = new Set();
  for (const font of fonts || []) {
    for (const file of font.files || []) {
      const id = `${font.family}|${file.key}|${file.url}`;
      wanted.add(id);
      if (installed.has(id)) continue;
      const format = FONT_FORMATS[file.format]?.css;
      const src = `url("${file.url}")${format ? ` format("${format}")` : ''}`;
      try {
        const face = new FontFace(font.family, src, { weight: String(file.weight), style: file.style, display: 'swap' });
        document.fonts.add(face);
        installed.set(id, face);
      } catch {
        /* a broken entry should not stop the others */
      }
    }
  }
  // Fonts deleted or replaced in admin are removed from this page too.
  for (const [id, face] of installed) {
    if (!wanted.has(id)) {
      document.fonts.delete(face);
      installed.delete(id);
    }
  }
}

/**
 * Loads the custom font list once (`fetchFonts` returns the list) and registers it.
 * Pages call this at start-up; the player waits for it before measuring text.
 */
export function initCustomFonts(fetchFonts) {
  installing = Promise.resolve()
    .then(fetchFonts)
    .then((fonts) => installFonts(fonts || []))
    .catch(() => {});
  return installing;
}

/** Resolves when the story's fonts are ready (or after `timeout` ms, whichever is first). */
export async function loadStoryFonts(story, timeout = 4000) {
  if (typeof document === 'undefined' || !document.fonts) return;
  const work = (async () => {
    if (installing) await installing;
    await Promise.all(
      storyFontUses(story).map(({ family, weight, style }) =>
        document.fonts.load(`${style === 'italic' ? 'italic ' : ''}${weight} 32px "${family}"`).catch(() => {}),
      ),
    );
    await document.fonts.ready;
  })();
  await Promise.race([work, new Promise((r) => setTimeout(r, timeout))]);
}

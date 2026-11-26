import { hasItalics } from './richText.js';
import { FONT_FAMILIES } from './constants.js';

/**
 * Fonts uploaded in admin Settings → Fonts. Each font family has one file per weight/style:
 *   { id, family: 'Geometria', files: [{ key: '700-normal', weight: 700, style: 'normal', url, format }] }
 * Story text stores the family name in `fontFamily`, like the built-in fonts.
 */

export const FONT_FORMATS = {
  woff2: { contentType: 'font/woff2', css: 'woff2' },
  woff: { contentType: 'font/woff', css: 'woff' },
  ttf: { contentType: 'font/ttf', css: 'truetype' },
  otf: { contentType: 'font/otf', css: 'opentype' },
};
export const FONT_EXTENSIONS = Object.keys(FONT_FORMATS);
export const FONT_ACCEPT = FONT_EXTENSIONS.map((e) => `.${e}`).join(',');
export const FONT_MAX_MB = 10;

export const FONT_WEIGHT_NAMES = {
  100: 'Thin',
  200: 'Extra light',
  300: 'Light',
  400: 'Regular',
  500: 'Medium',
  600: 'Semi bold',
  700: 'Bold',
  800: 'Extra bold',
  900: 'Black',
};
export const FONT_WEIGHT_OPTIONS = Object.keys(FONT_WEIGHT_NAMES).map(Number);

/** Family names become CSS font-family values, so keep them to plain characters. */
export const FONT_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 \-_]{0,59}$/;

export const variantKey = (weight, style) => `${weight}-${style === 'italic' ? 'italic' : 'normal'}`;
export const variantLabel = (f) => `${FONT_WEIGHT_NAMES[f.weight] || f.weight}${f.style === 'italic' ? ' italic' : ''}`;

/** Detects the file type from its first bytes (the extension can lie). */
export function sniffFontFormat(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (b.length < 4) return null;
  const tag = String.fromCharCode(b[0], b[1], b[2], b[3]);
  if (tag === 'wOF2') return 'woff2';
  if (tag === 'wOFF') return 'woff';
  if (tag === 'OTTO') return 'otf';
  if ((b[0] === 0 && b[1] === 1 && b[2] === 0 && b[3] === 0) || tag === 'true') return 'ttf';
  return null;
}

const WEIGHT_WORDS = [
  [/extra[\s_-]?light|ultra[\s_-]?light/i, 200],
  [/semi[\s_-]?bold|demi[\s_-]?bold/i, 600],
  [/extra[\s_-]?bold|ultra[\s_-]?bold/i, 800],
  [/thin|hairline/i, 100],
  [/light/i, 300],
  [/medium/i, 500],
  [/black|heavy/i, 900], // families with both ExtraBold and Heavy use Heavy as the 900
  [/bold/i, 700],
  [/regular|normal|book|roman/i, 400],
];

/** Guesses weight / style / family from a file name like "Geometria-BoldItalic.woff2". */
export function guessFontVariant(fileName = '') {
  const base = fileName.replace(/\.[^.]+$/, '');
  const style = /italic|oblique/i.test(base) ? 'italic' : 'normal';
  const numeric = base.match(/(?:^|[^0-9])([1-9]00)(?:[^0-9]|$)/);
  let weight = numeric ? Number(numeric[1]) : 400;
  if (!numeric) {
    for (const [re, w] of WEIGHT_WORDS) {
      if (re.test(base)) {
        weight = w;
        break;
      }
    }
  }
  const family = base
    .split(/[-_]/)[0]
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[^A-Za-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return { weight, style, family };
}

const BUILT_IN_NAMES = new Set(FONT_FAMILIES.flatMap((f) => [f.value.toLowerCase(), f.label.toLowerCase()]));
export const isBuiltInFontName = (name) => BUILT_IN_NAMES.has(String(name).trim().toLowerCase());

/** The Typography dropdown: built-in fonts, then uploaded ones (A–Z). */
export function fontFamilyOptions(customFonts = []) {
  const custom = [...customFonts]
    .filter((f) => f.files?.length)
    .sort((a, b) => a.family.localeCompare(b.family))
    .map((f) => ({ value: f.family, label: `${f.family} (uploaded)` }));
  return [...FONT_FAMILIES, ...custom];
}

/** Every font family / weight / style the story's text uses, e.g. for preloading. */
export function storyFontUses(story) {
  const uses = new Map();
  const use = (family, weight, style) => uses.set(`${family}|${weight}|${style}`, { family, weight, style });
  const add = (t) => {
    if (!t?.fontFamily) return;
    const style = t.fontStyle || 'normal';
    use(t.fontFamily, t.fontWeight ?? 600, style);
    // *Italic words* use the other style of the same font.
    if (hasItalics(t.content)) use(t.fontFamily, t.fontWeight ?? 600, style === 'italic' ? 'normal' : 'italic');
  };
  (story?.intro?.textElements || []).forEach(add);
  (story?.scenes || []).forEach((s) => (s.animationSteps || []).forEach((st) => (st.textElements || []).forEach(add)));
  return [...uses.values()];
}

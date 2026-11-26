/*
 * Light formatting inside story text (text boxes and image credits), Markdown style:
 *   *words*              italic
 *   [words](https://…)   link (opens in a new tab); the words may contain *italic* parts
 * A single * on its own stays a normal asterisk; only a pair makes italics.
 */
const ITALIC = /\*([^*\n]+?)\*/g;
const LINK = /\[([^\]\n]+)\]\(([^)\s]+)\)/g;

/**
 * Makes a typed address safe to open: web, mail and phone links only. "www.x.org" and
 * "x.org/page" get https://. Returns '' for anything else (e.g. javascript:).
 */
export function safeHref(raw) {
  const url = String(raw ?? '').trim();
  if (!url) return '';
  if (/^(https?:\/\/|mailto:|tel:)/i.test(url)) return url;
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return ''; // other schemes are not allowed
  if (/^(www\.|[a-z0-9-]+(\.[a-z0-9-]+)+)(\/|$|\?|#)/i.test(url)) return `https://${url}`;
  return '';
}

function italicParts(text) {
  const parts = [];
  let last = 0;
  for (const m of text.matchAll(ITALIC)) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index), italic: false });
    parts.push({ text: m[1], italic: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), italic: false });
  return parts;
}

/**
 * Splits text into parts: { text, italic } or { link: href, label, parts: [{ text, italic }] }.
 * A link whose address isn't allowed is kept as its words only.
 */
export function parseRich(value) {
  const text = String(value ?? '');
  const out = [];
  let last = 0;
  for (const m of text.matchAll(LINK)) {
    if (m.index > last) out.push(...italicParts(text.slice(last, m.index)));
    const href = safeHref(m[2]);
    if (href) out.push({ link: href, label: m[1], parts: italicParts(m[1]) });
    else out.push(...italicParts(m[1]));
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(...italicParts(text.slice(last)));
  return out;
}

/** Italic parts only (links flattened to their words), kept for older callers. */
export const parseItalics = (value) => parseRich(value).flatMap((p) => (p.link ? p.parts : [p]));

export const hasItalics = (value) => parseItalics(value).some((p) => p.italic);
export const hasLinks = (value) => parseRich(value).some((p) => p.link);

/** The words only, without * markers or link addresses (e.g. for lists and labels). */
export const stripItalics = (value) => parseItalics(value).map((p) => p.text).join('');
export const plainText = stripItalics;

const isWordChar = (c) => Boolean(c) && !/[\s*]/.test(c);

/** Expands an empty selection to the word at the caret and trims spaces off the ends. */
function wordRange(text, start, end) {
  let s = Math.max(0, Math.min(start ?? 0, text.length));
  let e = Math.max(s, Math.min(end ?? s, text.length));
  if (s === e) {
    while (s > 0 && isWordChar(text[s - 1])) s--;
    while (e < text.length && isWordChar(text[e])) e++;
  }
  while (s < e && /\s/.test(text[s])) s++;
  while (e > s && /\s/.test(text[e - 1])) e--;
  return [s, e];
}

/**
 * Toggles italics on the selection [start, end) of `value`, for the editor's Italic button and
 * Ctrl+I. With no selection, the word at the caret is used. Surrounding spaces are left out so
 * the markers hug the words. Returns { value, start, end } with the new selection.
 */
export function toggleItalic(value, start, end) {
  const text = String(value ?? '');
  const [s, e] = wordRange(text, start, end);
  if (s === e) return { value: text, start: start ?? 0, end: end ?? 0 };

  // Already italic: markers just outside the selection, or the selection includes them.
  if (text[s - 1] === '*' && text[e] === '*') {
    return { value: text.slice(0, s - 1) + text.slice(s, e) + text.slice(e + 1), start: s - 1, end: e - 1 };
  }
  if (e - s >= 2 && text[s] === '*' && text[e - 1] === '*') {
    return { value: text.slice(0, s) + text.slice(s + 1, e - 1) + text.slice(e), start: s, end: e - 2 };
  }
  // Remove markers inside the selection so the result is one italic run, then wrap it.
  const inner = text.slice(s, e).replace(/\*/g, '');
  return { value: `${text.slice(0, s)}*${inner}*${text.slice(e)}`, start: s + 1, end: s + 1 + inner.length };
}

/** The link the selection / caret is in or covers: { start, end, label, href } (raw positions). */
export function linkAt(value, start, end = start) {
  const text = String(value ?? '');
  for (const m of text.matchAll(LINK)) {
    const a = m.index;
    const b = a + m[0].length;
    if (start >= a && end <= b && !(start === b && end === b)) return { start: a, end: b, label: m[1], href: m[2] };
    if (start <= a && end >= b) return { start: a, end: b, label: m[1], href: m[2] };
  }
  return null;
}

/**
 * Links the selected words to `href` (or changes the address of the link the selection is in).
 * Returns { value, start, end } with the words selected, or null if there is nothing to link.
 */
export function setLink(value, start, end, href) {
  const text = String(value ?? '');
  const url = String(href ?? '').trim();
  const existing = linkAt(text, start, end);
  if (existing) {
    const md = `[${existing.label}](${url})`;
    return { value: text.slice(0, existing.start) + md + text.slice(existing.end), start: existing.start + 1, end: existing.start + 1 + existing.label.length };
  }
  const [s, e] = wordRange(text, start, end);
  if (s === e || !url) return null;
  const label = text.slice(s, e).replace(/[[\]]/g, '');
  const md = `[${label}](${url})`;
  return { value: text.slice(0, s) + md + text.slice(e), start: s + 1, end: s + 1 + label.length };
}

/** Removes the link the selection is in, keeping its words. Returns { value, start, end } or null. */
export function removeLink(value, start, end) {
  const text = String(value ?? '');
  const l = linkAt(text, start, end);
  if (!l) return null;
  return { value: text.slice(0, l.start) + l.label + text.slice(l.end), start: l.start, end: l.start + l.label.length };
}

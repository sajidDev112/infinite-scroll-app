/**
 * The intro screen footer (share / social buttons + logo + name), set once for the whole
 * site in admin Settings. Shared by the server (defaults, validation), the admin editor and
 * the player. Until an admin saves something, DEFAULT_FOOTER is what visitors see.
 */

/**
 * Button types.
 *   modes: 'action' (built-in behaviour), 'share' (share this story on the platform),
 *          'link' (open the admin's own URL, e.g. the museum's Instagram page).
 */
export const FOOTER_BUTTON_TYPES = [
  { type: 'like', label: 'Like', modes: ['action'] },
  { type: 'copyLink', label: 'Copy link', modes: ['action'] },
  { type: 'cite', label: 'Cite (copy a citation)', modes: ['action'] },
  { type: 'share', label: 'Share (device menu)', modes: ['action'] },
  { type: 'facebook', label: 'Facebook', modes: ['share', 'link'] },
  { type: 'x', label: 'X (Twitter)', modes: ['share', 'link'] },
  { type: 'whatsapp', label: 'WhatsApp', modes: ['share', 'link'] },
  { type: 'linkedin', label: 'LinkedIn', modes: ['share', 'link'] },
  { type: 'instagram', label: 'Instagram', modes: ['link'] },
  { type: 'youtube', label: 'YouTube', modes: ['link'] },
  { type: 'website', label: 'Website', modes: ['link'] },
  { type: 'email', label: 'Email', modes: ['share', 'link'] },
];
export const FOOTER_TYPE_IDS = FOOTER_BUTTON_TYPES.map((t) => t.type);
export const FOOTER_MAX_BUTTONS = 12;
export const footerType = (type) => FOOTER_BUTTON_TYPES.find((t) => t.type === type);

export const DEFAULT_BRAND_NAME = 'Museum of Art & Photography';

export const DEFAULT_FOOTER = Object.freeze({
  brandName: DEFAULT_BRAND_NAME,
  showBrandName: true,
  showLogo: true,
  /** null = the built-in MAP logo. Otherwise { imageId, url } of an uploaded image. */
  logo: null,
  buttons: [
    { type: 'like', enabled: true, mode: 'action', url: '' },
    { type: 'copyLink', enabled: true, mode: 'action', url: '' },
    { type: 'cite', enabled: true, mode: 'action', url: '' },
    { type: 'facebook', enabled: true, mode: 'share', url: '' },
    { type: 'x', enabled: true, mode: 'share', url: '' },
    { type: 'share', enabled: true, mode: 'action', url: '' },
  ],
});

/** Fills gaps and drops anything unknown, so the player never breaks on odd data. */
export function normalizeFooter(input) {
  const f = input && typeof input === 'object' ? input : {};
  const buttons = Array.isArray(f.buttons) ? f.buttons : DEFAULT_FOOTER.buttons;
  return {
    brandName: typeof f.brandName === 'string' ? f.brandName : DEFAULT_FOOTER.brandName,
    showBrandName: f.showBrandName !== false,
    showLogo: f.showLogo !== false,
    logo: f.logo && f.logo.url ? { imageId: f.logo.imageId || null, url: f.logo.url } : null,
    buttons: buttons
      .filter((b) => b && footerType(b.type))
      .slice(0, FOOTER_MAX_BUTTONS)
      .map((b) => {
        const t = footerType(b.type);
        return {
          type: b.type,
          enabled: b.enabled !== false,
          mode: t.modes.includes(b.mode) ? b.mode : t.modes[0],
          url: typeof b.url === 'string' ? b.url.trim() : '',
        };
      }),
  };
}

/** Problems that would make a button do nothing; shown in the editor, enforced on save. */
export function footerIssues(footer) {
  const issues = [];
  footer.buttons.forEach((b, i) => {
    if (b.enabled && b.mode === 'link') {
      const ok = b.type === 'email' ? /^(mailto:)?[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(b.url) : /^https?:\/\/\S+\.\S+/i.test(b.url);
      if (!ok) issues.push({ index: i, message: `${footerType(b.type).label}: enter a full ${b.type === 'email' ? 'email address' : 'link starting with https://'}.` });
    }
  });
  return issues;
}

/**
 * Citation for a story, copied by the Cite button, e.g.
 *   Miniature Worlds. Museum of Art & Photography. https://…/stories/abc (accessed 26 November 2026).
 */
export function storyCitation({ title, brandName, url, date = new Date() } = {}) {
  const accessed = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const parts = [String(title || '').trim(), String(brandName || '').trim()].filter(Boolean).map((t) => (/[.!?]$/.test(t) ? t : `${t}.`));
  const link = String(url || '').trim();
  return [...parts, link ? `${link} (accessed ${accessed}).` : `Accessed ${accessed}.`].join(' ');
}

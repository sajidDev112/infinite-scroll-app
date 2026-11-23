import { useEffect, useRef, useState } from 'react';
import brandLogo from './assets/brand-logo.png';
import { DEFAULT_BRAND_NAME, DEFAULT_FOOTER, footerType, normalizeFooter } from '../engine/footer.js';

export const BRAND_NAME = DEFAULT_BRAND_NAME;
/** The built-in MAP logo, used when no logo has been uploaded in Settings. */
export const DEFAULT_LOGO_URL = brandLogo;
/** Used by the share buttons until a public story page URL is configured. */
export const DEFAULT_SHARE_URL = 'https://map-india.org/';

/** Share link for a story: a template where {id} becomes the story id, e.g. https://site/stories/{id}. */
export function resolveShareUrl(template, storyId) {
  const t = (template || '').trim() || DEFAULT_SHARE_URL;
  return storyId ? t.replace('{id}', encodeURIComponent(storyId)) : t.replace('{id}', '');
}
const LIKES_KEY = 'sf_liked_stories';

const ICONS = {
  heart: (filled) => (
    <svg viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20.5s-7.5-4.6-9.3-9.1C1.5 8.3 3.6 4.5 7.3 4.5c2 0 3.5 1.1 4.7 2.8 1.2-1.7 2.7-2.8 4.7-2.8 3.7 0 5.8 3.8 4.6 6.9-1.8 4.5-9.3 9.1-9.3 9.1Z" />
    </svg>
  ),
  link: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.2 1.2" />
      <path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2" />
    </svg>
  ),
  facebook: () => (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1h-4.6v-6.9h2.3l.4-2.7h-2.7V9.7c0-.8.2-1.3 1.4-1.3h1.4V6c-.3 0-1.1-.1-2.1-.1-2.1 0-3.5 1.3-3.5 3.6v1.9H9.3v2.7h2.3V21H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
    </svg>
  ),
  x: () => (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.8 3h3.1l-6.8 7.7 8 10.3h-6.2l-4.9-6.3L5.4 21H2.3l7.2-8.3L1.8 3h6.4l4.4 5.8L17.8 3Zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5Z" />
    </svg>
  ),
  whatsapp: () => (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2.2a9.7 9.7 0 0 0-8.4 14.6L2.3 21.8l5.1-1.3A9.7 9.7 0 1 0 12 2.2Zm0 17.7a8 8 0 0 1-4.1-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1 1 12 19.9Zm4.4-6c-.2-.1-1.4-.7-1.7-.8-.2-.1-.4-.1-.5.1l-.8 1c-.1.2-.3.2-.5.1a6.6 6.6 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.5-.4h-.5a.9.9 0 0 0-.7.3 2.8 2.8 0 0 0-.9 2.1 4.9 4.9 0 0 0 1 2.6 11.3 11.3 0 0 0 4.3 3.8c1.6.7 2.3.7 3.1.6.5-.1 1.4-.6 1.6-1.2.2-.6.2-1 .1-1.2l-.6-.3Z" />
    </svg>
  ),
  linkedin: () => (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M4.5 3A1.5 1.5 0 0 0 3 4.5v15A1.5 1.5 0 0 0 4.5 21h15a1.5 1.5 0 0 0 1.5-1.5v-15A1.5 1.5 0 0 0 19.5 3h-15Zm3.3 6.6v8.6H5.1V9.6h2.7ZM6.4 5.5a1.6 1.6 0 1 1 0 3.1 1.6 1.6 0 0 1 0-3.1Zm4 4.1h2.6v1.2c.4-.7 1.3-1.4 2.6-1.4 2.8 0 3.3 1.8 3.3 4.2v4.6h-2.7v-4.1c0-1 0-2.3-1.4-2.3s-1.6 1.1-1.6 2.2v4.2h-2.7V9.6Z" />
    </svg>
  ),
  instagram: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5" />
      <circle cx="12" cy="12" r="4.1" />
      <circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  ),
  youtube: () => (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M21.6 7.2a2.6 2.6 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4a2.6 2.6 0 0 0-1.8 1.8A27 27 0 0 0 2 12a27 27 0 0 0 .4 4.8 2.6 2.6 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.6 2.6 0 0 0 1.8-1.8A27 27 0 0 0 22 12a27 27 0 0 0-.4-4.8ZM10 15V9l5.2 3L10 15Z" />
    </svg>
  ),
  website: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </svg>
  ),
  email: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  ),
  share: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="18" cy="5" r="2.6" />
      <circle cx="6" cy="12" r="2.6" />
      <circle cx="18" cy="19" r="2.6" />
      <path d="m8.3 10.8 7.4-4.4M8.3 13.2l7.4 4.4" />
    </svg>
  ),
};

function readLikes() {
  try {
    return new Set(JSON.parse(localStorage.getItem(LIKES_KEY) || '[]'));
  } catch {
    return new Set();
  }
}

async function copyText(text) {
  // Desktop app: use Electron's clipboard (works regardless of page focus or origin).
  if (window.storyframe?.copyText) {
    try {
      return await window.storyframe.copyText(text);
    } catch { /* fall through to the web clipboard */ }
  }
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

const openWindow = (url) => window.open(url, '_blank', 'noopener,noreferrer,width=640,height=560');
const openTab = (url) => window.open(url, '_blank', 'noopener,noreferrer');

/** Share-this-story URLs for each platform. */
const SHARE_URLS = {
  facebook: (url) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  x: (url, text) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}${url ? `&url=${encodeURIComponent(url)}` : ''}`,
  whatsapp: (url, text) => `https://wa.me/?text=${encodeURIComponent(url ? `${text} ${url}` : text)}`,
  linkedin: (url) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
  email: (url, text) => `mailto:?subject=${encodeURIComponent(text)}&body=${encodeURIComponent(url || text)}`,
};

const LINK_LABELS = { website: 'our website' };
const ICON_KEY = { like: 'heart', copyLink: 'link' };

/**
 * Footer on a story's intro screen: the share / social buttons, logo and name set in
 * admin Settings (`footer`; the built-in defaults when not given).
 * `interactive={false}` renders a still preview (editor).
 */
export function IntroFooter({ storyId, title, description, shareUrl, interactive = true, footer: footerProp }) {
  const footer = normalizeFooter(footerProp || DEFAULT_FOOTER);
  const brandName = footer.brandName.trim();
  const [liked, setLiked] = useState(false);
  const [note, setNote] = useState('');
  const timer = useRef(0);

  useEffect(() => {
    if (storyId) setLiked(readLikes().has(storyId));
    return () => clearTimeout(timer.current);
  }, [storyId]);

  const flash = (msg) => {
    setNote(msg);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setNote(''), 2200);
  };

  const url = shareUrl || '';
  const text = title ? (brandName ? `${title} — ${brandName}` : title) : brandName || 'Story';

  const run = async (b) => {
    if (b.mode === 'link') {
      if (b.type === 'email') window.location.href = b.url.startsWith('mailto:') ? b.url : `mailto:${b.url}`;
      else openTab(b.url);
      return;
    }
    if (b.mode === 'share') {
      const link = SHARE_URLS[b.type](url, text);
      if (b.type === 'email') window.location.href = link;
      else openWindow(link);
      return;
    }
    if (b.type === 'like') {
      const likes = readLikes();
      if (likes.has(storyId)) likes.delete(storyId);
      else likes.add(storyId);
      try { localStorage.setItem(LIKES_KEY, JSON.stringify([...likes])); } catch { /* storage unavailable */ }
      setLiked(likes.has(storyId));
      flash(likes.has(storyId) ? 'Added to your favourites' : 'Removed from favourites');
    } else if (b.type === 'copyLink') {
      flash((await copyText(url || text)) ? 'Link copied' : 'Could not copy the link');
    } else if (b.type === 'share') {
      if (navigator.share) {
        try {
          await navigator.share({ title: text, text: description || text, url: url || undefined });
          return;
        } catch (err) {
          if (err?.name === 'AbortError') return;
        }
      }
      flash((await copyText(url || text)) ? 'Link copied — paste it anywhere to share' : 'Could not copy the link');
    }
  };

  const label = (b) => {
    if (b.type === 'like') return liked ? 'Unlike this story' : 'Like this story';
    if (b.type === 'copyLink') return 'Copy link';
    if (b.type === 'share') return 'Share';
    if (b.mode === 'link') return b.type === 'email' ? 'Email us' : `Visit ${LINK_LABELS[b.type] || footerType(b.type).label}`;
    return `Share on ${footerType(b.type).label}`;
  };

  // Link buttons without a link are skipped rather than shown doing nothing.
  const buttons = footer.buttons.filter((b) => b.enabled && (b.mode !== 'link' || b.url));
  const logoUrl = footer.logo?.url || DEFAULT_LOGO_URL;

  return (
    <div className={`sp-footer${interactive ? '' : ' is-static'}`}>
      {buttons.length > 0 && (
        <div className="sp-social" role="group" aria-label="Share and follow">
          {buttons.map((b, i) => {
            const on = b.type === 'like' && liked;
            const key = ICON_KEY[b.type] || b.type;
            return (
              <button
                key={`${b.type}-${i}`}
                type="button"
                className={`sp-social-btn${on ? ' is-on' : ''}`}
                aria-label={label(b)}
                title={label(b)}
                aria-pressed={b.type === 'like' ? liked : undefined}
                tabIndex={interactive ? 0 : -1}
                onClick={interactive ? () => run(b) : undefined}
              >
                {key === 'heart' ? ICONS.heart(on) : ICONS[key]()}
              </button>
            );
          })}
        </div>
      )}
      <div className="sp-footer-note" role="status" aria-live="polite">{note}</div>
      {footer.showLogo && <img className="sp-brand-logo" src={logoUrl} alt={brandName || 'Logo'} draggable={false} />}
      {footer.showBrandName && brandName && <div className="sp-brand-name">{brandName}</div>}
    </div>
  );
}

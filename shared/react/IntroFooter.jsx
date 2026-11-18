import { useEffect, useRef, useState } from 'react';
import brandLogo from './assets/brand-logo.png';

export const BRAND_NAME = 'Museum of Art & Photography';
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

/**
 * Footer on a story's intro screen: like / copy link / Facebook / X / share,
 * then the museum logo and name. `interactive={false}` renders a still preview (editor).
 */
export function IntroFooter({ storyId, title, description, shareUrl, interactive = true }) {
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
  const text = title ? `${title} — ${BRAND_NAME}` : BRAND_NAME;

  const actions = {
    like: () => {
      const likes = readLikes();
      if (likes.has(storyId)) likes.delete(storyId);
      else likes.add(storyId);
      try { localStorage.setItem(LIKES_KEY, JSON.stringify([...likes])); } catch { /* storage unavailable */ }
      setLiked(likes.has(storyId));
      flash(likes.has(storyId) ? 'Added to your favourites' : 'Removed from favourites');
    },
    link: async () => flash((await copyText(url || text)) ? 'Link copied' : 'Could not copy the link'),
    facebook: () => openWindow(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`),
    x: () => openWindow(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}${url ? `&url=${encodeURIComponent(url)}` : ''}`),
    share: async () => {
      if (navigator.share) {
        try {
          await navigator.share({ title: text, text: description || text, url: url || undefined });
          return;
        } catch (err) {
          if (err?.name === 'AbortError') return;
        }
      }
      flash((await copyText(url || text)) ? 'Link copied — paste it anywhere to share' : 'Could not copy the link');
    },
  };

  const buttons = [
    { key: 'like', label: liked ? 'Unlike this story' : 'Like this story', icon: ICONS.heart(liked), on: liked },
    { key: 'link', label: 'Copy link', icon: ICONS.link() },
    { key: 'facebook', label: 'Share on Facebook', icon: ICONS.facebook() },
    { key: 'x', label: 'Share on X', icon: ICONS.x() },
    { key: 'share', label: 'Share', icon: ICONS.share() },
  ];

  return (
    <div className={`sp-footer${interactive ? '' : ' is-static'}`}>
      <div className="sp-social" role="group" aria-label="Share this story">
        {buttons.map((b) => (
          <button
            key={b.key}
            type="button"
            className={`sp-social-btn${b.on ? ' is-on' : ''}`}
            aria-label={b.label}
            title={b.label}
            aria-pressed={b.key === 'like' ? liked : undefined}
            tabIndex={interactive ? 0 : -1}
            onClick={interactive ? actions[b.key] : undefined}
          >
            {b.icon}
          </button>
        ))}
      </div>
      <div className="sp-footer-note" role="status" aria-live="polite">{note}</div>
      <img className="sp-brand-logo" src={brandLogo} alt="MAP — Museum of Art & Photography" draggable={false} />
      <div className="sp-brand-name">{BRAND_NAME}</div>
    </div>
  );
}

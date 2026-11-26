import { forwardRef } from 'react';
import impartLogo from './assets/impart-logo.png';

/**
 * Impart site header on the story's opening cover: the Impart logo on the left, search and
 * menu icons on the right (as on imp-art.org). Change the addresses here if they move.
 */
export const IMPART_HEADER = Object.freeze({
  name: 'Impart',
  homeUrl: 'https://imp-art.org/',
  searchUrl: 'https://imp-art.org/?s=',
  menuUrl: 'https://imp-art.org/',
});

// Icons from the supplied search.svg / menu.svg (Lucide "search" and "menu").
export function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="m21 21-4.34-4.34" />
      <circle cx="11" cy="11" r="8" />
    </svg>
  );
}

export function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M4 5h16" />
      <path d="M4 12h16" />
      <path d="M4 19h16" />
    </svg>
  );
}

/**
 * The header is part of the cover only: the story player fades it out as soon as the viewer
 * starts scrolling. `interactive={false}` renders a still preview (editor), without links.
 * `logoUrl`: the logo uploaded in Settings (the same one everywhere); the Impart logo when none.
 */
export const IntroHeader = forwardRef(function IntroHeader({ interactive = true, logoUrl }, ref) {
  const link = (href, label, children, className) =>
    interactive ? (
      <a className={className} href={href} target="_blank" rel="noopener noreferrer" aria-label={label}>{children}</a>
    ) : (
      <span className={className} aria-hidden="true">{children}</span>
    );

  return (
    <header ref={ref} className={`sp-header${interactive ? '' : ' is-static'}`}>
      {link(IMPART_HEADER.homeUrl, `${IMPART_HEADER.name} home (opens in a new tab)`, <img src={logoUrl || impartLogo} alt="" draggable={false} />, 'sp-header-logo')}
      <nav className="sp-header-actions" aria-label={`${IMPART_HEADER.name} site`}>
        {link(IMPART_HEADER.searchUrl, `Search ${IMPART_HEADER.name} (opens in a new tab)`, <SearchIcon />, 'sp-header-icon')}
        {link(IMPART_HEADER.menuUrl, `${IMPART_HEADER.name} menu (opens in a new tab)`, <MenuIcon />, 'sp-header-icon sp-header-menu')}
      </nav>
    </header>
  );
});

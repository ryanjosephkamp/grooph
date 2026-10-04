import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import "./chrome.css";

/**
 * The header and the footer of the site (handoff 0077), in the form of the owner's Link Meteor site: a night bar with
 * the mark, the menu and the theme switch, and his footer. The document pages carry the same two, written as HTML by
 * scripts/site/layout.mjs and styled by the same chrome.css; a test holds the two footers to the same links.
 */

export const SOURCE = "https://github.com/ryanjosephkamp/grooph";

/** The site's own pages (handoff 0060), beside the app. */
export const DOCS = `${import.meta.env.BASE_URL}docs/`;

/** The looks the theme switch offers. The first is the page as it loads; the rest are `data-theme` on the root. */
export const THEMES = [
  { id: "grooph", label: "Grooph", dot: "oklch(0.85 0.14 165)" },
  { id: "meteor", label: "Meteor", dot: "oklch(0.9 0.2 124)" },
] as const;
type ThemeId = (typeof THEMES)[number]["id"];

/** Where the choice is kept. index.html reads it before the first paint, and so does every document page. */
const THEME_KEY = "groophTheme";

const shownTheme = (): ThemeId => THEMES.find((t) => t.id === document.documentElement.dataset.theme)?.id ?? THEMES[0].id;

/** grooph's mark: three nodes and the edges between them, as on the app's icon. */
export function Mark() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8.5" />
      <path d="M13.5 12.5 19 21M18.5 12.5 13 21M14 11h4" />
      <circle cx="10" cy="11" r="4" />
      <circle cx="22" cy="11" r="4" />
      <circle cx="16" cy="23" r="4" />
    </svg>
  );
}

const Check = () => (
  <svg viewBox="0 0 20 20" aria-hidden="true">
    <path d="m4.5 10.5 3.5 3.5 7.5-8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
export { Check };

export function SiteHeader() {
  const [menu, setMenu] = useState(false);
  const [theme, setTheme] = useState<ThemeId>(shownTheme);
  const bar = useRef<HTMLElement>(null);

  // While the front page is up, the browser's own bar takes the header's color; the screens after it get theirs back.
  useEffect(() => {
    const metas = Array.from(document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'));
    const before = metas.map((m) => m.content);
    const night = bar.current ? getComputedStyle(bar.current).backgroundColor : "";
    if (night) for (const m of metas) m.content = night;
    return () => metas.forEach((m, i) => (m.content = before[i]!));
  }, [theme]);

  return (
    <header className="site-header has-menu" ref={bar} onKeyDown={(e) => e.key === "Escape" && setMenu(false)}>
      <div className="site-wrap">
        <a className="site-logo" href="#/">
          <Mark />
          <span>grooph</span>
        </a>
        <button className="site-menu-toggle" type="button" aria-expanded={menu} aria-controls="site-nav" onClick={() => setMenu(!menu)}>
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M3.5 6h13M3.5 10h13M3.5 14h13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          Menu
        </button>
        <nav className={`site-nav land-nav${menu ? " is-open" : ""}`} id="site-nav" aria-label="grooph" onClick={() => setMenu(false)}>
          <ul>
            <li>
              <a href="#/templates">Templates</a>
            </li>
            <li>
              <a href={DOCS}>Docs</a>
            </li>
            <li>
              <a href={`${DOCS}field-guide/`}>Field guide</a>
            </li>
            <li>
              <a href={SOURCE} rel="noopener">
                Source
                <svg viewBox="0 0 20 20" aria-hidden="true">
                  <path d="M11.5 3.5h5v5M16.5 3.5l-7 7M14.5 12v3.5a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1H8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="sr-only"> (GitHub)</span>
              </a>
            </li>
          </ul>
        </nav>
        <ThemeMenu theme={theme} onTheme={setTheme} />
      </div>
    </header>
  );
}

/** The theme switch, a menu button: arrows move, Enter or Space chooses, Escape closes. The choice is kept in this browser. */
function ThemeMenu({ theme, onTheme }: { theme: ThemeId; onTheme: (id: ThemeId) => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);
  const at = THEMES.findIndex((t) => t.id === theme);

  useEffect(() => {
    if (!open) return;
    items.current[at]?.focus();
    const away = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", away);
    return () => document.removeEventListener("click", away);
  }, [open, at]);

  const close = () => {
    setOpen(false);
    toggle.current?.focus();
  };
  const choose = (id: ThemeId) => {
    if (id === THEMES[0].id) delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = id;
    try {
      localStorage.setItem(THEME_KEY, id);
    } catch {
      /* shown, not kept */
    }
    // A ?theme= in the address would bring the old choice back on the next load.
    const url = new URL(location.href);
    if (url.searchParams.has("theme")) {
      url.searchParams.delete("theme");
      history.replaceState(history.state, "", url);
    }
    onTheme(id);
    close();
  };
  const onListKey = (e: KeyboardEvent) => {
    const here = items.current.indexOf(document.activeElement as HTMLButtonElement);
    const to = e.key === "ArrowDown" ? (here + 1) % THEMES.length : e.key === "ArrowUp" ? (here - 1 + THEMES.length) % THEMES.length : e.key === "Home" ? 0 : e.key === "End" ? THEMES.length - 1 : -1;
    if (to >= 0) {
      e.preventDefault();
      items.current[to]?.focus();
    } else if (e.key === "Escape") {
      e.stopPropagation();
      close();
    } else if (e.key === "Tab") setOpen(false);
  };

  return (
    <div className="site-theme" ref={root}>
      <button
        className="site-theme-toggle"
        type="button"
        ref={toggle}
        title="Theme"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="site-theme-list"
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span className="site-theme-dot" aria-hidden="true" />
        <span className="site-theme-label">Theme</span>
        <span className="sr-only">: {THEMES[at]!.label}</span>
      </button>
      <ul className="site-theme-list" id="site-theme-list" role="menu" aria-label="Theme" hidden={!open} onKeyDown={onListKey}>
        {THEMES.map((t, i) => (
          <li role="none" key={t.id}>
            <button type="button" role="menuitemradio" aria-checked={t.id === theme} tabIndex={-1} ref={(el) => void (items.current[i] = el)} onClick={() => choose(t.id)}>
              <span className="site-theme-dot" style={{ ["--dot" as string]: t.dot }} aria-hidden="true" />
              {t.label}
              <Check />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The owner's five links, in his order, each with its accessible name. The paths are Simple Icons' and Link Meteor's. */
const SOCIAL = [
  { href: "https://ryanjosephkamp.github.io/", name: "Ryan Kamp’s website", title: "Website", stroke: true, d: "M2.8 12h18.4M12 2.8c2.6 2.6 3.9 5.7 3.9 9.2s-1.3 6.6-3.9 9.2c-2.6-2.6-3.9-5.7-3.9-9.2S9.4 5.4 12 2.8ZM21.2 12a9.2 9.2 0 1 1-18.4 0 9.2 9.2 0 0 1 18.4 0Z" },
  { href: "https://github.com/ryanjosephkamp/", name: "Ryan Kamp on GitHub", title: "GitHub", d: "M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" },
  { href: "https://www.linkedin.com/in/rjk1999", name: "Ryan Kamp on LinkedIn", title: "LinkedIn", d: "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" },
  { href: "https://x.com/ryanjosephkamp", name: "Ryan Kamp on X", title: "X", d: "M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" },
  { href: "https://m.youtube.com/@RyanJosephKamp", name: "Ryan Kamp on YouTube", title: "YouTube", d: "M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" },
] as const;

export function SiteFooter() {
  return (
    <footer className="site-footer land-foot">
      <div className="site-wrap">
        <div>
          <a className="site-logo" href="#/">
            <Mark />
            <span>grooph</span>
          </a>
          <p>Loop graphs for coding agents. Graphs live in this browser on this device. Nothing is sent anywhere.</p>
        </div>
        <div>
          <h2>Use it</h2>
          <ul>
            <li>
              <a href="#/templates">Templates</a>
            </li>
            <li>
              <a href={`${DOCS}quickstart/`}>Quickstart</a>
            </li>
            <li>
              <a href={`${DOCS}field-guide/`}>Field guide</a>
            </li>
            <li>
              <a href={DOCS}>Docs</a>
            </li>
          </ul>
        </div>
        <div>
          <h2>Help and contact</h2>
          <ul>
            <li>
              <a href={`${SOURCE}/issues`} rel="noopener">
                Report a bug or suggest a feature
              </a>
            </li>
            <li>
              <a href={`${DOCS}community/`}>Community loops</a>
            </li>
            <li>
              <a href={SOURCE} rel="noopener">
                Source on GitHub
              </a>
            </li>
          </ul>
        </div>
        <div className="site-credit">
          <p className="site-made">
            Made by <a href="https://ryanjosephkamp.github.io/">Ryan Kamp</a>
          </p>
          <ul className="site-social" aria-label="Ryan Kamp online">
            {SOCIAL.map((s) => (
              <li key={s.href}>
                <a href={s.href} aria-label={s.name} title={s.title}>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    {"stroke" in s ? <path d={s.d} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /> : <path d={s.d} fill="currentColor" />}
                  </svg>
                </a>
              </li>
            ))}
          </ul>
          <a className="site-sponsor" href="https://github.com/sponsors/ryanjosephkamp">
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M10 16.8S3 12.6 3 7.6A3.6 3.6 0 0 1 10 6a3.6 3.6 0 0 1 7 1.6c0 5-7 9.2-7 9.2Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
            </svg>
            Sponsor on GitHub
          </a>
        </div>
        <p className="site-fine">
          Every feature is free; sponsorship is optional and never unlocks anything. MIT license, © 2026 Ryan Kamp. This site uses no cookies, analytics or
          third-party requests. Fonts: Atkinson Hyperlegible Next and Mono, SIL Open Font License.{" "}
          <a href={`${SOURCE}#license-and-author`} rel="noopener">
            Credits
          </a>
        </p>
      </div>
    </footer>
  );
}

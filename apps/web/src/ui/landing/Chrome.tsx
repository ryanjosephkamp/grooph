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
  const toggle = useRef<HTMLButtonElement>(null);
  // Escape folds the links away again, and focus goes back to the button that showed them.
  const fold = () => {
    if (!menu) return;
    setMenu(false);
    toggle.current?.focus();
  };

  // While the front page is up, the browser's own bar takes the header's color; the screens after it get theirs back.
  useEffect(() => {
    const metas = Array.from(document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'));
    const before = metas.map((m) => m.content);
    const night = bar.current ? getComputedStyle(bar.current).backgroundColor : "";
    if (night) for (const m of metas) m.content = night;
    return () => metas.forEach((m, i) => (m.content = before[i]!));
  }, [theme]);

  return (
    <header className="site-header has-menu" ref={bar} onKeyDown={(e) => e.key === "Escape" && fold()}>
      <div className="site-wrap">
        <a className="site-logo" href="#/">
          <Mark />
          <span>grooph</span>
        </a>
        <button className="site-menu-toggle" type="button" ref={toggle} aria-expanded={menu} aria-controls="site-nav" onClick={() => setMenu(!menu)}>
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
    // A press, not a click: a phone's browser sends no click for a tap on text.
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
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
    const to = e.key === "ArrowDown" ? (here + 1) % ENTRIES : e.key === "ArrowUp" ? (here - 1 + ENTRIES) % ENTRIES : e.key === "Home" ? 0 : e.key === "End" ? ENTRIES - 1 : -1;
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
        aria-label={`Theme: ${THEMES[at]!.label}`}
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
        {/* The pictures' themes (handoff 0086) are a piece fetched when this is pressed, and nothing of them is here
            but this entry: `data-pictures` is what `doc/look.ts` listens for, and the list of six opens in this
            one's place. That file comes a moment after the front page, so a press before it is left as a mark. */}
        <li role="none">
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            data-pictures=""
            ref={(el) => void (items.current[THEMES.length] = el)}
            onClick={(e) => {
              e.currentTarget.dataset["pressed"] = "";
              setOpen(false);
            }}
          >
            <span className="site-theme-dot" style={{ ["--dot" as string]: "#0000" }} aria-hidden="true" />
            Picture theme
          </button>
        </li>
      </ul>
    </div>
  );
}
/** The menu's entries: the site's looks, and the way to the pictures' themes. */
const ENTRIES = THEMES.length + 1;

/** The footer's icons, one file of the site (public/assets/site-icons.v1.svg) that every page shares, fetched once the page is up. */
const ICONS = `${import.meta.env.BASE_URL}assets/site-icons.v1.svg`;

/** The owner's five links, in his order, each with its accessible name. */
const SOCIAL = [
  { href: "https://ryanjosephkamp.github.io/", name: "Ryan Kamp’s website", title: "Website", icon: "globe" },
  { href: "https://github.com/ryanjosephkamp/", name: "Ryan Kamp on GitHub", title: "GitHub", icon: "github" },
  { href: "https://www.linkedin.com/in/rjk1999", name: "Ryan Kamp on LinkedIn", title: "LinkedIn", icon: "linkedin" },
  { href: "https://x.com/ryanjosephkamp", name: "Ryan Kamp on X", title: "X", icon: "x" },
  { href: "https://m.youtube.com/@RyanJosephKamp", name: "Ryan Kamp on YouTube", title: "YouTube", icon: "youtube" },
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
                  <svg aria-hidden="true">
                    <use href={`${ICONS}#${s.icon}`} />
                  </svg>
                </a>
              </li>
            ))}
          </ul>
          <a className="site-sponsor" href="https://github.com/sponsors/ryanjosephkamp">
            <svg aria-hidden="true">
              <use href={`${ICONS}#heart`} />
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

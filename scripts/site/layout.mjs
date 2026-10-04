/**
 * The page around a document (handoff 0060; in the owner's style, handoff 0077): the site's header and footer, a night
 * band with the title, the reading column with its contents list, the inline style and the one inline script. Pure
 * functions of their arguments, so a page is the same on every run.
 *
 * The header and the footer are the front page's (apps/web/src/ui/landing/Chrome.tsx), written here as HTML and styled
 * by the same stylesheet, which is read from beside that component. scripts/site/site-pages.test.mjs holds the two to
 * the same links and the same themes.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { escapeHtml } from "./markdown.mjs";

const here = dirname(fileURLToPath(import.meta.url));
// Comments and indentation do not need to be sent.
const squeeze = (css) =>
  css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\s+/g, " ")
    .replace(/ ?([{};,>]) ?/g, "$1")
    .replace(/([a-z0-9-]): /g, "$1:")
    .replace(/;}/g, "}")
    .trim();
export const STYLE = squeeze(readFileSync(join(here, "style.css"), "utf8") + readFileSync(join(here, "..", "..", "apps", "web", "src", "ui", "landing", "chrome.css"), "utf8"));
export const SCRIPT = readFileSync(join(here, "page.js"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .trim();

/** The fonts, files of the site under assets/fonts/ (scripts/site/subset-fonts.py made them). */
export const FONTS = [
  { family: "Atkinson Hyperlegible Next", file: "atkinson-hyperlegible-next.v1.woff2", weight: "400 800", style: "normal" },
  { family: "Atkinson Hyperlegible Next", file: "atkinson-hyperlegible-next-italic.v1.woff2", weight: "400 800", style: "italic" },
  { family: "Atkinson Hyperlegible Mono", file: "atkinson-hyperlegible-mono.v1.woff2", weight: "400 700", style: "normal" },
];
const fontFaces = (root) => FONTS.map((f) => `@font-face{font-family:"${f.family}";src:url("${root}assets/fonts/${f.file}") format("woff2");font-weight:${f.weight};font-style:${f.style};font-display:swap}`).join("");

/** The looks the theme switch offers, as on the front page: the first is the page as it loads. */
export const THEMES = [
  { id: "grooph", label: "Grooph", dot: "oklch(0.85 0.14 165)" },
  { id: "meteor", label: "Meteor", dot: "oklch(0.9 0.2 124)" },
];
/** Before the first paint: ?theme= wins and is kept, then the kept choice. */
const THEME_SCRIPT = `(()=>{const ids=${JSON.stringify(THEMES.map((t) => t.id))};let id=new URLSearchParams(location.search).get("theme");try{if(ids.includes(id))localStorage.setItem("groophTheme",id);else id=localStorage.getItem("groophTheme")}catch{}if(ids.indexOf(id)>0)document.documentElement.dataset.theme=id})()`;

/** The owner's five links, in his order, each with its accessible name. */
export const SOCIAL = [
  { href: "https://ryanjosephkamp.github.io/", name: "Ryan Kamp’s website", title: "Website", icon: "globe" },
  { href: "https://github.com/ryanjosephkamp/", name: "Ryan Kamp on GitHub", title: "GitHub", icon: "github" },
  { href: "https://www.linkedin.com/in/rjk1999", name: "Ryan Kamp on LinkedIn", title: "LinkedIn", icon: "linkedin" },
  { href: "https://x.com/ryanjosephkamp", name: "Ryan Kamp on X", title: "X", icon: "x" },
  { href: "https://m.youtube.com/@RyanJosephKamp", name: "Ryan Kamp on YouTube", title: "YouTube", icon: "youtube" },
];
export const SPONSOR = "https://github.com/sponsors/ryanjosephkamp";

const LINE = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
/** The footer's icons: one file of the site that every page shares (apps/web/public/assets/site-icons.v1.svg). */
const icon = (root, id) => `<svg aria-hidden="true"><use href="${root}assets/site-icons.v1.svg#${id}"/></svg>`;
const MARK = '<svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8.5"/><path d="M13.5 12.5 19 21M18.5 12.5 13 21M14 11h4"/><circle cx="10" cy="11" r="4"/><circle cx="22" cy="11" r="4"/><circle cx="16" cy="23" r="4"/></svg>';
const CHECK = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m4.5 10.5 3.5 3.5 7.5-8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const EXTERNAL = `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M11.5 3.5h5v5M16.5 3.5l-7 7M14.5 12v3.5a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1H8" ${LINE}/></svg>`;

/** The header. The Menu button and the theme switch are there for the script to show: with scripts off the links wrap and the page keeps its look. */
function header(p) {
  const links = p.nav
    .map((item) => {
      const outside = /^https?:/.test(item.href);
      return `<li><a href="${escapeHtml(item.href)}"${item.current ? ' aria-current="page"' : ""}${outside ? ' rel="noopener"' : ""}>${escapeHtml(item.label)}${outside ? `${EXTERNAL}<span class="sr-only"> (GitHub)</span>` : ""}</a></li>`;
    })
    .join("");
  const themes = THEMES.map(
    (t, i) => `<li role="none"><button type="button" role="menuitemradio" aria-checked="${i === 0}" tabindex="-1" data-theme-id="${t.id}"><span class="site-theme-dot" style="--dot:${t.dot}" aria-hidden="true"></span>${t.label}${CHECK}</button></li>`,
  ).join("");
  return `<header class="site-header"><div class="site-wrap"><a class="site-logo" href="${p.root}">${MARK}<span>grooph</span></a><button class="site-menu-toggle" type="button" aria-expanded="false" aria-controls="site-nav" hidden><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3.5 6h13M3.5 10h13M3.5 14h13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>Menu</button><nav class="site-nav" id="site-nav" aria-label="grooph"><ul>${links}</ul></nav><div class="site-theme" hidden><button class="site-theme-toggle" type="button" aria-label="Theme: ${THEMES[0].label}" aria-haspopup="menu" aria-expanded="false" aria-controls="site-theme-list"><span class="site-theme-dot" aria-hidden="true"></span><span class="site-theme-label">Theme</span></button><ul class="site-theme-list" id="site-theme-list" role="menu" aria-label="Theme" hidden>${themes}</ul></div></div></header>`;
}

/** The owner's footer, as on the front page. `p.foot` holds the two columns of links, which name only pages the site has. */
function footer(p) {
  const column = (title, links) => `<div><h2>${title}</h2><ul>${links.map((l) => `<li><a href="${escapeHtml(l.href)}"${/^https?:/.test(l.href) ? ' rel="noopener"' : ""}>${escapeHtml(l.label)}</a></li>`).join("")}</ul></div>`;
  const social = SOCIAL.map((s) => `<li><a href="${s.href}" aria-label="${s.name}" title="${s.title}">${icon(p.root, s.icon)}</a></li>`).join("");
  const source = p.source ? ` Rendered from <a href="${escapeHtml(p.source)}" rel="noopener">${escapeHtml(p.sourceLabel ?? "the source")}</a>; edit it on GitHub.` : "";
  return `<footer class="site-footer"><div class="site-wrap"><div><a class="site-logo" href="${p.root}">${MARK}<span>grooph</span></a><p>Loop graphs for coding agents. Graphs live in this browser on this device. Nothing is sent anywhere.</p></div>${column("Use it", p.foot.use)}${column("Help and contact", p.foot.help)}<div class="site-credit"><p class="site-made">Made by <a href="${SOCIAL[0].href}">Ryan Kamp</a></p><ul class="site-social" aria-label="Ryan Kamp online">${social}</ul><a class="site-sponsor" href="${SPONSOR}">${icon(p.root, "heart")}Sponsor on GitHub</a></div><p class="site-fine">Every feature is free; sponsorship is optional and never unlocks anything. MIT license, © 2026 Ryan Kamp. This site uses no cookies, analytics or third-party requests. Fonts: Atkinson Hyperlegible Next and Mono, SIL Open Font License. <a href="${escapeHtml(p.repo)}#license-and-author" rel="noopener">Credits</a>.${source}</p></div></footer>`;
}

/**
 * @param {object} p
 * @param {string} p.title            the page's own title; the tab reads "title · grooph"
 * @param {string} p.description
 * @param {string} p.canonical        absolute address
 * @param {string} p.root             relative path from this page to the app's root, ending in "/"
 * @param {string} p.imageUrl         absolute address of the link-preview image
 * @param {{ label: string, href: string, current: boolean }[]} p.nav
 * @param {{ use: { label: string, href: string }[], help: { label: string, href: string }[] }} p.foot  the footer's two columns
 * @param {string} p.hero             the title band: the h1 and, when the document opens with a short one, its first paragraph
 * @param {string} [p.chip]           the small label above the title: the section the page belongs to
 * @param {string} [p.toc]            the contents list, already HTML
 * @param {string} p.body             the column under the band, already HTML
 * @param {boolean} [p.wide]          the column takes the whole width (the index)
 * @param {string} p.repo             address of the repository
 * @param {string} [p.source]         address of this page's source file on GitHub
 * @param {string} [p.sourceLabel]    its repository path
 */
export function shell(p) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#061a14">
<title>${escapeHtml(p.title)} · grooph</title>
<meta name="description" content="${escapeHtml(p.description)}">
<link rel="canonical" href="${escapeHtml(p.canonical)}">
<link rel="icon" href="${p.root}favicon.svg" type="image/svg+xml">
<link rel="preload" href="${p.root}assets/fonts/${FONTS[0].file}" as="font" type="font/woff2" crossorigin>
<meta property="og:type" content="article">
<meta property="og:site_name" content="grooph">
<meta property="og:title" content="${escapeHtml(p.title)} · grooph">
<meta property="og:description" content="${escapeHtml(p.description)}">
<meta property="og:url" content="${escapeHtml(p.canonical)}">
<meta property="og:image" content="${escapeHtml(p.imageUrl)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(p.title)} · grooph">
<meta name="twitter:description" content="${escapeHtml(p.description)}">
<meta name="twitter:image" content="${escapeHtml(p.imageUrl)}">
<script>${THEME_SCRIPT}</script>
<style>${fontFaces(p.root)}${STYLE}</style>
</head>
<body>
<a class="skip" href="#main">Skip to the content</a>
${header(p)}
<main id="main">
<div class="page-hero"><div class="site-wrap">
${p.chip ? `<p class="page-chip">${escapeHtml(p.chip)}</p>\n` : ""}${p.hero}
</div></div>
<div class="site-wrap page-body${p.toc ? " has-toc" : ""}">
${p.toc ? `${p.toc}\n` : ""}<div class="doc${p.wide ? " doc-wide" : ""}">
${p.body}
</div>
</div>
</main>
${footer(p)}
<script>${SCRIPT}</script>
</body>
</html>
`;
}

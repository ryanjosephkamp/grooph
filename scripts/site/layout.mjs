/**
 * The page around a document (handoff 0060): the front page's bar and foot, the reading column, the inline style and the
 * one inline script. Pure functions of their arguments, so a page is the same on every run.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { escapeHtml } from "./markdown.mjs";

const here = dirname(fileURLToPath(import.meta.url));
export const STYLE = readFileSync(join(here, "style.css"), "utf8")
  // Comments and indentation do not need to be sent.
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\s+/g, " ")
  .replace(/ ?([{};,>]) ?/g, "$1")
  .replace(/([a-z0-9-]): /g, "$1:")
  .replace(/;}/g, "}")
  .trim();
export const SCRIPT = readFileSync(join(here, "page.js"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .trim();

/**
 * @param {object} p
 * @param {string} p.title            the page's own title; the tab reads "title · grooph"
 * @param {string} p.description
 * @param {string} p.canonical        absolute address
 * @param {string} p.root             relative path from this page to the app's root, ending in "/"
 * @param {string} p.imageUrl         absolute address of the link-preview image
 * @param {{ label: string, href: string, current: boolean }[]} p.nav
 * @param {string} p.body             the main column, already HTML
 * @param {string} p.repo             address of the repository
 * @param {string} [p.source]         address of this page's source file on GitHub
 * @param {string} [p.sourceLabel]    its repository path
 */
export function shell(p) {
  const nav = p.nav
    .map((item) => `<a href="${escapeHtml(item.href)}"${item.current ? ' aria-current="page"' : ""}${/^https?:/.test(item.href) ? ' rel="noopener"' : ""}>${escapeHtml(item.label)}</a>`)
    .join("");
  const source = p.source ? `<span>Rendered from <a href="${escapeHtml(p.source)}" rel="noopener">${escapeHtml(p.sourceLabel ?? "the source")}</a>. Edit it on GitHub.</span>` : `<span>Pages from the repository's own documents.</span>`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#f6f5f1" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#16171a" media="(prefers-color-scheme: dark)">
<title>${escapeHtml(p.title)} · grooph</title>
<meta name="description" content="${escapeHtml(p.description)}">
<link rel="canonical" href="${escapeHtml(p.canonical)}">
<link rel="icon" href="${p.root}favicon.svg" type="image/svg+xml">
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
<style>${STYLE}</style>
</head>
<body>
<a class="skip" href="#main">Skip to the content</a>
<header class="bar"><div class="wrap"><a class="wordmark" href="${p.root}">grooph</a><nav class="nav" aria-label="grooph">${nav}</nav></div></header>
<main id="main" class="doc">
${p.body}
</main>
<footer class="foot"><div class="wrap"><div>${source}<span><a href="${escapeHtml(p.repo)}" rel="noopener">Source</a> · MIT</span></div></div></footer>
<script>${SCRIPT}</script>
</body>
</html>
`;
}

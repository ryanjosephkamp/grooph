#!/usr/bin/env node
/**
 * Render the repository's documents to static pages for the site (handoff 0060).
 *
 *   node scripts/site-pages.mjs --out <dir>    write <dir>/docs/index.html and <dir>/docs/<slug>/index.html
 *   node scripts/site-pages.mjs --check        render to a temporary folder and fail (exit 1) on a broken link between
 *                                              pages, on Markdown left unrendered, on a page over the size limit, on a
 *                                              color variable that drifted from the app's, in any of its themes
 *
 * The documents are named in scripts/site/pages.json. One that is listed and missing is skipped with a line on standard
 * error; `docs/blog/*.md` and `docs/report/*.md` are taken as they appear. The Markdown renderer is scripts/site/markdown.mjs,
 * the look is scripts/site/style.css with the front page's own header and footer, the page around a document is scripts/site/layout.mjs. No dependency,
 * no network, and nothing about the app's own bundle: the pages are plain files beside it.
 *
 * Links between documents that are both pages become links between the pages. Any other relative link becomes a link to the
 * file on GitHub, and a relative image is copied beside the page that shows it.
 *
 * GROOPH_SITE_ROOT points the script at another folder of documents, for its own tests (scripts/site/site-pages.test.mjs).
 */
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, extname, join, posix, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

import { shell } from "./site/layout.mjs";
import { escapeHtml, renderMarkdown } from "./site/markdown.mjs";

const here = dirname(fileURLToPath(import.meta.url));
/** Where the documents and the app's styles are read from: this repository, unless a test points it at a folder of its own. */
const root = resolve(process.env.GROOPH_SITE_ROOT ?? join(here, ".."));
const config = JSON.parse(readFileSync(join(here, "site", "pages.json"), "utf8"));
const SITE = config.site;
/** A page's HTML, gzipped and without its images, stays under this. */
const PAGE_LIMIT_KB = 40;
/** A document's first paragraph stands under its title, in the band, when it is no longer than this. */
const LEDE_LIMIT = 320;

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name) => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
};
if (flag("--help") || flag("-h")) {
  console.log("usage: node scripts/site-pages.mjs --out <dir>\n       node scripts/site-pages.mjs --check");
  process.exit(0);
}

// ─── what is on the site ─────────────────────────────────────────────────────

/** The listed documents that exist, in order, with the section each belongs to. */
function collect() {
  const groups = [];
  for (const g of config.groups) {
    const group = { id: g.id, title: g.title, sections: [] };
    for (const entry of g.entries) {
      if (entry.glob) {
        const at = entry.glob.lastIndexOf("/");
        const dir = entry.glob.slice(0, at);
        const pattern = new RegExp(`^${entry.glob.slice(at + 1).replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`);
        const names = existsSync(join(root, dir)) ? readdirSync(join(root, dir)).filter((n) => pattern.test(n) && !/^(?:readme\.md|[._])/i.test(n)).sort() : [];
        if (entry.order === "newest") names.reverse();
        if (names.length === 0) continue;
        group.sections.push({
          id: entry.id,
          label: entry.label,
          pages: names.map((name) => ({ source: `${dir}/${name}`, slug: `${entry.slugPrefix}${name.replace(/\.md$/i, "")}`, group: g.id, section: entry.id })),
        });
      } else if (existsSync(join(root, entry.source))) {
        // Named documents share one unlabelled section, so the index lists them together.
        let plainSection = group.sections.find((section) => section.label === undefined);
        if (!plainSection) group.sections.push((plainSection = { pages: [] }));
        plainSection.pages.push({ source: entry.source, slug: entry.slug, summary: entry.summary, group: g.id });
      } else {
        process.stderr.write(`site-pages: skipped ${entry.source} (it is not in the repository yet)\n`);
      }
    }
    if (group.sections.length > 0) groups.push(group);
  }
  return groups;
}

// ─── addresses ───────────────────────────────────────────────────────────────

const ABSOLUTE = /^(?:[A-Za-z][A-Za-z0-9+.-]*:|\/\/|#)/;
const github = (kind, path) => `${SITE.repo}/${kind}/${SITE.branch}/${path.split("/").map(encodeURIComponent).join("/")}`;
const slugDir = (slug) => `docs/${slug}`;
/** The address of one page's folder from another's, ending in a slash. */
const pageHref = (from, to) => {
  const rel = posix.relative(slugDir(from), to === "" ? "docs" : slugDir(to));
  return rel === "" ? "./" : `${rel}/`;
};
/** The path from a page's folder up to the app's root. */
const rootOf = (slug) => "../".repeat(1 + (slug === "" ? 0 : slug.split("/").length));
/** The path from a page's folder to the docs index, ending in a slash. */
const docsOf = (slug) => (slug === "" ? "./" : "../".repeat(slug.split("/").length));

const IMAGE_COPY = /\.(?:svg|png|jpe?g|gif|webp|avif|ico|mp4|webm)$/i;

/**
 * The two functions the renderer is given for a page: `link` and `image` map an address in the document's source to the
 * one the page uses.
 */
function resolvers(page, bySource, problems) {
  const assets = new Map(); // name beside the page → absolute source path
  const wholes = new Map(); // a shorter view's name beside the page → the whole picture's name
  const pathOf = (href) => {
    if (ABSOLUTE.test(href)) return null;
    const bare = href.split("#")[0].split("?")[0];
    const frag = href.includes("#") ? href.slice(href.indexOf("#")) : "";
    let decoded = bare;
    try {
      decoded = decodeURI(bare);
    } catch {}
    const target = decoded.startsWith("/") ? posix.normalize(decoded.slice(1)) : posix.normalize(posix.join(posix.dirname(page.source), decoded));
    return { target: target === "." ? "" : target, frag };
  };
  const link = (href) => {
    const at = pathOf(href);
    if (at === null) return href;
    if (at.target === "") return at.frag || "./";
    if (at.target.startsWith("..")) {
      problems.warn(`${page.source}: link ${href} leaves the repository`);
      return href;
    }
    const to = bySource.get(at.target);
    if (to) return to.slug === page.slug ? at.frag || "./" : `${pageHref(page.slug, to.slug)}${at.frag}`;
    const full = join(root, at.target);
    if (!existsSync(full)) {
      problems.warn(`${page.source}: link ${href} points at ${at.target}, which is not in the repository`);
      return `${github("blob", at.target)}${at.frag}`;
    }
    // A picture a page links to (the poster) is a file of the site, beside the page, as a picture it shows is.
    if (!statSync(full).isDirectory() && IMAGE_COPY.test(at.target)) return `${image(href.split("#")[0], true)}${at.frag}`;
    return `${github(statSync(full).isDirectory() ? "tree" : "blob", at.target)}${at.frag}`;
  };
  /** Copies a picture beside the page and gives its name there; a second file with the same name gets a number. */
  const beside = (from) => {
    let name = basename(from);
    for (let n = 2; assets.has(name) && assets.get(name) !== from; n += 1) name = `${basename(from, extname(from))}-${n}${extname(from)}`;
    assets.set(name, from);
    return encodeURIComponent(name);
  };
  function image(src, whole = false) {
    const at = pathOf(src);
    if (at === null) return src;
    const from = join(root, at.target);
    if (at.target.startsWith("..") || !existsSync(from) || statSync(from).isDirectory() || !IMAGE_COPY.test(at.target)) {
      problems.error(`${page.source}: image ${src} is not a file in the repository`);
      return src;
    }
    // A long picture with a shorter view beside it (handoff 0077): when `<name>.short.<ext>` stands beside a picture
    // a page shows, the page shows the short one, and it opens the whole one. A link to the picture is still to all of it.
    const short = `${from.slice(0, -extname(from).length)}.short${extname(from)}`;
    if (!whole && existsSync(short)) {
      const shown = beside(short);
      wholes.set(shown, beside(from));
      return shown;
    }
    return beside(from);
  }
  return { link, image, assets, wholes };
}

/** Each picture shown by its shorter view becomes a link to the whole picture, unless it already stands inside a link. */
function linkWholes(html, wholes) {
  for (const [short, whole] of wholes) {
    html = html.replace(new RegExp(`<img\\b[^>]*\\ssrc="${short.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*>`, "g"), (img, at) => {
      const before = html.slice(0, at);
      if (before.lastIndexOf("<a ") > before.lastIndexOf("</a>")) return img;
      return `<a class="whole" href="${whole}">${img}<span>The whole picture</span></a>`;
    });
  }
  return html;
}

// ─── building ────────────────────────────────────────────────────────────────

const plain = (html) => html.replace(/<[^>]*>/g, "");
const gzipKB = (text) => gzipSync(Buffer.from(text)).length / 1024;

/** A paragraph cut for a card or a description, at a word. */
function clip(text, limit) {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= limit) return flat;
  const cut = flat.slice(0, limit - 1);
  return `${cut.slice(0, cut.lastIndexOf(" ") > limit / 2 ? cut.lastIndexOf(" ") : cut.length).replace(/[\s,;:(-]+$/, "")}…`;
}

function writeFile(path, data) {
  mkdirSync(dirname(path), { recursive: true });
  const temp = `${path}.tmp-${process.pid}`;
  writeFileSync(temp, data);
  renameSync(temp, path);
}

/** Renders every page into `out/docs/`; returns what was found wrong and what was written. */
function build(out) {
  const problems = { errors: [], warnings: [], error: (m) => problems.errors.push(m), warn: (m) => problems.warnings.push(m) };
  const groups = collect();
  const pages = groups.flatMap((g) => g.sections.flatMap((s) => s.pages));
  const bySource = new Map(pages.map((p) => [p.source, p]));
  const seen = new Map();
  for (const page of pages) {
    if (seen.has(page.slug)) problems.error(`${page.source} and ${seen.get(page.slug)} both want the address docs/${page.slug}/`);
    seen.set(page.slug, page.source);
  }

  const has = (id) => groups.some((g) => g.sections.some((s) => s.id === id || (s.pages ?? []).some((p) => p.slug === id)));
  const navFor = (slug, current) => {
    const docs = docsOf(slug);
    return [
      { label: "Templates", href: `${rootOf(slug)}#/templates`, current: false },
      { label: "Docs", href: docs, current: current === "docs" },
      ...(has("field-guide") ? [{ label: "Field guide", href: `${docs}field-guide/`, current: current === "field-guide" }] : []),
      ...(has("blog") ? [{ label: "Blog", href: `${docs}#blog`, current: current === "blog" }] : []),
      { label: "Source", href: SITE.repo, current: false },
    ];
  };
  /** The footer's two columns, as on the front page; a page the site does not have is left out. */
  const footFor = (slug) => {
    const docs = docsOf(slug);
    return {
      use: [
        { label: "Templates", href: `${rootOf(slug)}#/templates` },
        ...(has("quickstart") ? [{ label: "Quickstart", href: `${docs}quickstart/` }] : []),
        ...(has("field-guide") ? [{ label: "Field guide", href: `${docs}field-guide/` }] : []),
        { label: "Docs", href: docs },
      ],
      help: [
        { label: "Report a bug or suggest a feature", href: `${SITE.repo}/issues` },
        ...(has("community") ? [{ label: "Community loops", href: `${docs}community/` }] : []),
        { label: "Source on GitHub", href: SITE.repo },
      ],
    };
  };
  /** The small label above a page's title: the section it belongs to. */
  const chipFor = (page) => {
    const group = groups.find((g) => g.id === page.group);
    return group?.sections.find((s) => s.id !== undefined && s.id === page.section)?.label ?? group?.title;
  };

  const written = [];
  for (const page of pages) {
    const md = readFileSync(join(root, page.source), "utf8");
    const { link, image, assets, wholes } = resolvers(page, bySource, problems);
    const rendered = renderMarkdown(md, { link, image });
    rendered.html = linkWholes(rendered.html, wholes);
    for (const d of rendered.diagnostics) problems.error(`${page.source}:${d.line}: ${d.message}`);
    page.title = rendered.title ?? page.slug;
    page.summary = page.summary ?? clip(rendered.summary ?? "", 170);

    // The title goes in the night band at the top of the page, with the document's first paragraph when it opens with
    // a short one; the rest is the column. A document whose title is not its first line keeps it where it is.
    let body = rendered.html;
    let hero = `<h1>${escapeHtml(page.title)}</h1>`;
    const opening = /^(<h1[^>]*>[\s\S]*?<\/h1>)\n?(<p>[\s\S]*?<\/p>)?\n?/.exec(body);
    if (opening) {
      const lede = opening[2] !== undefined && plain(opening[2]).length <= LEDE_LIMIT ? opening[2] : "";
      hero = `${opening[1]}${lede ? `\n${lede}` : ""}`;
      body = body.slice(opening[1].length + (lede ? opening[0].length - opening[1].length : 0)).replace(/^\n/, "");
    } else if (rendered.title !== null) hero = "";
    const h2 = rendered.headings.filter((h) => h.level === 2);
    const toc = h2.length >= 4 ? `<details class="toc"><summary>On this page</summary><ul>${h2.map((h) => `<li><a href="#${h.id}">${escapeHtml(h.text)}</a></li>`).join("")}</ul></details>` : "";
    const current = page.slug === "field-guide" ? "field-guide" : page.slug.startsWith("blog/") ? "blog" : "docs";
    const html = shell({
      title: page.title,
      description: clip(page.summary || rendered.summary || page.title, 200),
      canonical: `${SITE.url}docs/${page.slug}/`,
      root: rootOf(page.slug),
      imageUrl: `${SITE.url}og.png`,
      nav: navFor(page.slug, current),
      foot: footFor(page.slug),
      chip: chipFor(page),
      hero,
      toc,
      body,
      repo: SITE.repo,
      source: github("blob", page.source),
      sourceLabel: page.source,
    });
    page.kb = gzipKB(html);
    if (page.kb > PAGE_LIMIT_KB) problems.error(`${page.source}: the page is ${page.kb.toFixed(1)} KB gzipped, over the ${PAGE_LIMIT_KB} KB limit`);
    const dir = join(out, "docs", page.slug);
    writeFile(join(dir, "index.html"), html);
    for (const [name, from] of assets) {
      mkdirSync(dir, { recursive: true });
      copyFileSync(from, join(dir, name));
    }
    written.push(page);
  }

  // The index.
  const card = (p) => `<li><a class="card" href="${p.slug}/"><strong>${escapeHtml(p.title)}</strong><span>${escapeHtml(p.summary)}</span></a></li>`;
  const sections = groups
    .map((g) => {
      const parts = g.sections.map((s) => `${s.label ? `<h3 id="${s.id}">${escapeHtml(s.label)}</h3>\n` : ""}<ul class="cards">\n${s.pages.map(card).join("\n")}\n</ul>`);
      return `<section class="group" aria-labelledby="group-${g.id}">\n<h2 id="group-${g.id}">${escapeHtml(g.title)}</h2>\n${parts.join("\n")}\n</section>`;
    })
    .join("\n");
  const index = shell({
    title: "Docs",
    description: config.intro,
    canonical: `${SITE.url}docs/`,
    root: rootOf(""),
    imageUrl: `${SITE.url}og.png`,
    nav: navFor("", "docs"),
    foot: footFor(""),
    hero: `<h1 id="docs">Docs</h1>\n<p>${escapeHtml(config.intro)}</p>`,
    body: sections,
    wide: true,
    repo: SITE.repo,
  });
  const indexKB = gzipKB(index);
  if (indexKB > PAGE_LIMIT_KB) problems.error(`the docs index is ${indexKB.toFixed(1)} KB gzipped, over the ${PAGE_LIMIT_KB} KB limit`);
  writeFile(join(out, "docs", "index.html"), index);
  return { problems, pages: written, indexKB, groups };
}

// ─── checking ────────────────────────────────────────────────────────────────

/** The app's front page links into the documents by address. Each address must be a file the pages made. */
function checkAppLinks(out, problems) {
  const landing = join(root, "apps", "web", "src", "ui", "landing");
  if (!existsSync(landing)) return;
  for (const name of readdirSync(landing).filter((f) => f.endsWith(".tsx"))) {
    const text = readFileSync(join(landing, name), "utf8");
    for (const m of text.matchAll(/\$\{DOCS\}([^`"'\s}]*)/g)) {
      const address = m[1].split("#")[0];
      let target = join(out, "docs", address);
      if (existsSync(target) && statSync(target).isDirectory()) target = join(target, "index.html");
      if (!existsSync(target)) problems.error(`apps/web/src/ui/landing/${name}: the front page links to docs/${address}, which the site does not have`);
    }
  }
}

/** Every page's addresses, followed: a link between pages must land on a file, and a #fragment on a heading. */
function checkLinks(out, problems) {
  const docs = join(out, "docs");
  const files = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (name.endsWith(".html")) files.push(full);
    }
  };
  walk(docs);
  const ids = new Map();
  const htmls = new Map(files.map((f) => [f, readFileSync(f, "utf8")]));
  for (const [file, html] of htmls) ids.set(file, new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])));
  for (const [file, html] of htmls) {
    const shown = relative(out, file);
    const addresses = [];
    for (const m of html.matchAll(/\s(?:href|src|poster)="([^"]*)"/g)) addresses.push(m[1].replace(/&amp;/g, "&"));
    for (const m of html.matchAll(/\ssrcset="([^"]*)"/g)) for (const part of m[1].split(",")) addresses.push(part.trim().split(/\s+/)[0]);
    for (const address of addresses) {
      if (address === "" || /^(?:[A-Za-z][A-Za-z0-9+.-]*:|\/\/)/.test(address)) continue;
      const [pathPart, frag] = address.split("#");
      let target = file;
      if (pathPart !== "") {
        let decoded = pathPart.split("?")[0];
        try {
          decoded = decodeURIComponent(decoded);
        } catch {}
        target = resolve(dirname(file), decoded);
        // Beyond the pages: the app's own root and files, which this check does not render.
        if (relative(docs, target).startsWith("..")) continue;
        if (existsSync(target) && statSync(target).isDirectory()) target = join(target, "index.html");
        if (!existsSync(target)) {
          problems.error(`${shown}: the link ${address} goes nowhere`);
          continue;
        }
      }
      if (frag && target.endsWith(".html") && ids.has(target) && !ids.get(target).has(decodeURIComponent(frag))) problems.error(`${shown}: the link ${address} names a heading that is not there`);
    }
  }
}

/** The variables the pages copy from the app's :root must be the app's. */
function checkTokens(problems) {
  // Each block of variables by what it is for: "light" and "dark" are :root's, "meteor, light" and "meteor, dark" a theme's.
  const blocks = (css) => {
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");
    const decls = (text) => new Map([...text.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim().replace(/\s+/g, " ")]));
    const found = new Map();
    const take = (text, pattern, scheme) =>
      text.replace(pattern, (_, theme, body) => {
        const key = theme ? `${theme}, ${scheme}` : scheme;
        if (!found.has(key)) found.set(key, decls(body));
        return "";
      });
    // The dark blocks first, and out of the way: what is left of a `:root { … }` is then a light one.
    const light = take(bare, /@media\s*\(prefers-color-scheme:\s*dark\)\s*\{\s*:root(?:\[data-theme="([\w-]+)"\])?\s*\{([^}]*)\}/g, "dark");
    take(light, /:root(?:\[data-theme="([\w-]+)"\])?\s*\{([^}]*)\}/g, "light");
    return found;
  };
  const app = blocks(readFileSync(join(root, "apps", "web", "src", "styles.css"), "utf8"));
  const site = blocks(readFileSync(join(here, "site", "style.css"), "utf8"));
  if (!site.get("light")?.size || !site.get("dark")?.size) problems.error("scripts/site/style.css: no :root variables found, light or dark");
  for (const key of app.keys()) if (!site.has(key)) problems.error(`scripts/site/style.css: the app's variables for ${key} are not here, so a page would not take that look`);
  for (const [key, vars] of site) {
    for (const [name, v] of vars) {
      const theirs = app.get(key)?.get(name);
      if (theirs === undefined) problems.error(`scripts/site/style.css: ${name} (${key}) is not in apps/web/src/styles.css`);
      else if (theirs !== v) problems.error(`scripts/site/style.css: ${name} (${key}) is "${v}" here and "${theirs}" in apps/web/src/styles.css`);
    }
  }
}

// ─── main ────────────────────────────────────────────────────────────────────

const kb = (n) => `${n.toFixed(1)} KB`;

if (flag("--check")) {
  const temp = mkdtempSync(join(tmpdir(), "grooph-site-"));
  try {
    const { problems, pages, indexKB } = build(temp);
    checkLinks(temp, problems);
    checkAppLinks(temp, problems);
    checkTokens(problems);
    for (const w of problems.warnings) process.stderr.write(`site-pages: warning: ${w}\n`);
    if (problems.errors.length > 0) {
      for (const e of problems.errors) process.stderr.write(`site-pages: ${e}\n`);
      process.stderr.write(`site-pages: ${problems.errors.length} problem${problems.errors.length === 1 ? "" : "s"}\n`);
      process.exit(1);
    }
    const largest = pages.reduce((a, b) => (b.kb > a.kb ? b : a), { kb: 0, slug: "" });
    console.log(`site-pages: ok. ${pages.length} pages and an index, links and anchors resolve, nothing unrendered; largest page ${largest.slug} at ${kb(largest.kb)} gzipped (limit ${PAGE_LIMIT_KB} KB), index ${kb(indexKB)}.`);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
} else {
  const out = value("--out");
  if (!out || out.startsWith("--")) {
    console.error("site-pages: --out <dir> or --check is required");
    process.exit(2);
  }
  const target = resolve(out);
  if (resolve(target, "docs") === join(root, "docs")) {
    console.error("site-pages: --out would write into the repository's own docs/ folder; give it a build folder, such as apps/web/dist");
    process.exit(2);
  }
  const { problems, pages, indexKB } = build(target);
  for (const w of problems.warnings) process.stderr.write(`site-pages: warning: ${w}\n`);
  for (const e of problems.errors) process.stderr.write(`site-pages: warning: ${e}\n`);
  console.log(`site-pages: ${pages.length} pages and an index into ${join(target, "docs")} (${pages.map((p) => `${p.slug} ${kb(p.kb)}`).join(", ")}; index ${kb(indexKB)}; gzipped)`);
}

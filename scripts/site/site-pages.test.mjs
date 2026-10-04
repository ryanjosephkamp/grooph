// scripts/site-pages.mjs, end to end (handoff 0060, criteria 1 and 5): what it renders, what it skips, and what --check refuses.
// Each case builds a small tree of documents in a temporary folder and points the script at it (GROOPH_SITE_ROOT).
// Run with: node --test scripts/site/site-pages.test.mjs
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const script = join(repo, "scripts", "site-pages.mjs");

/** A temporary tree: the given files, plus the app's stylesheet (the pages' colors are checked against it). */
function tree(files) {
  const root = mkdtempSync(join(tmpdir(), "grooph-site-test-"));
  mkdirSync(join(root, "apps", "web", "src"), { recursive: true });
  cpSync(join(repo, "apps", "web", "src", "styles.css"), join(root, "apps", "web", "src", "styles.css"));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}
const run = (root, ...args) => spawnSync(process.execPath, [script, ...args], { env: { ...process.env, GROOPH_SITE_ROOT: root }, encoding: "utf8" });
const check = (files) => {
  const root = tree(files);
  try {
    return run(root, "--check");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

const QUICKSTART = "# Quickstart\n\nStart here. See [the rules](rules.md#e_one).\n";
const RULES = "# Rule reference\n\nEvery rule.\n\n## `E_ONE`\n\nText.\n";

test("a clean set passes, and a document listed but missing is skipped with a line on standard error", () => {
  const r = check({ "docs/quickstart.md": QUICKSTART, "docs/rules.md": RULES });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stderr, /skipped docs\/graph-ir\.md \(it is not in the repository yet\)/);
  assert.match(r.stdout, /ok\. 2 pages and an index/);
});

test("--check fails on a link between pages that names a heading that is not there", () => {
  const r = check({ "docs/quickstart.md": "# Quickstart\n\nSee [the rules](rules.md#e_two).\n", "docs/rules.md": RULES });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /quickstart\/index\.html: the link \.\.\/rules\/#e_two names a heading that is not there/);
});

test("--check fails on Markdown left unrendered: a stray ** and a pipe row outside a table", () => {
  const stray = check({ "docs/quickstart.md": "# Quickstart\n\nA **never closed.\n", "docs/rules.md": RULES });
  assert.equal(stray.status, 1);
  assert.match(stray.stderr, /docs\/quickstart\.md:3: "\*\*" was left over/);
  const pipes = check({ "docs/quickstart.md": "# Quickstart\n\n| a | b |\n| 1 | 2 |\n", "docs/rules.md": RULES });
  assert.equal(pipes.status, 1);
  assert.match(pipes.stderr, /docs\/quickstart\.md:3: pipe rows outside a table/);
});

test("--check fails on an image that is not in the repository, and on a page over 40 KB gzipped", () => {
  const image = check({ "docs/quickstart.md": "# Quickstart\n\n![x](missing.png)\n", "docs/rules.md": RULES });
  assert.equal(image.status, 1);
  assert.match(image.stderr, /image missing\.png is not a file in the repository/);
  // Words that do not repeat do not compress.
  let seed = 7;
  const words = Array.from({ length: 40000 }, () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed.toString(36);
  });
  const big = `# Quickstart\n\n${words.join(" ")}\n`;
  assert.ok(gzipSync(Buffer.from(big)).length > 40 * 1024);
  const heavy = check({ "docs/quickstart.md": big, "docs/rules.md": RULES });
  assert.equal(heavy.status, 1);
  assert.match(heavy.stderr, /the page is \d+\.\d KB gzipped, over the 40 KB limit/);
});

test("--check fails when a color variable here is not the app's", () => {
  const root = tree({ "docs/quickstart.md": QUICKSTART, "docs/rules.md": RULES });
  try {
    const css = join(root, "apps", "web", "src", "styles.css");
    writeFileSync(css, readFileSync(css, "utf8").replace("--accent: #1f5f4a;", "--accent: #123456;"));
    const r = run(root, "--check");
    assert.equal(r.status, 1);
    assert.match(r.stderr, /--accent \(light\) is "#1f5f4a" here and "#123456" in apps\/web\/src\/styles\.css/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a link to another file is a link to it on GitHub; one to a file that is not there is a warning, not a page", () => {
  const root = tree({ "docs/quickstart.md": "# Quickstart\n\n[a](../fixtures/x.json), [b](../nowhere.md), [c](.), [d](https://example.com/).\n", "fixtures/x.json": "{}" });
  const out = mkdtempSync(join(tmpdir(), "grooph-site-out-"));
  try {
    const r = run(root, "--out", out);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stderr, /warning: docs\/quickstart\.md: link \.\.\/nowhere\.md points at nowhere\.md, which is not in the repository/);
    const page = readFileSync(join(out, "docs", "quickstart", "index.html"), "utf8");
    assert.match(page, /href="https:\/\/github\.com\/ryanjosephkamp\/grooph\/blob\/main\/fixtures\/x\.json"/);
    assert.match(page, /href="https:\/\/github\.com\/ryanjosephkamp\/grooph\/tree\/main\/docs"/);
    assert.match(page, /href="https:\/\/example\.com\/" rel="noopener"/);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(out, { recursive: true, force: true });
  }
});

test("--out writes the index and a folder per page; blog posts, reports and the field guide are taken as they appear, with their images beside them", () => {
  const root = tree({
    "docs/quickstart.md": QUICKSTART,
    "docs/rules.md": RULES,
    "docs/field-guide.md": "# Field guide\n\nTwenty shapes.\n\n![A](field-guide/a.svg)\n\nSee [the post](blog/2026-10-05-hello.md).\n",
    "docs/field-guide/a.svg": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>',
    "docs/blog/2026-10-05-hello.md": "# Hello\n\nThe first post.\n\n<picture>\n<img src=\"../field-guide/a.svg\" alt=\"A\">\n</picture>\n",
    "docs/blog/2026-10-01-earlier.md": "# Earlier\n\nAn older post.\n",
    "docs/blog/README.md": "# not a post\n",
    "docs/report/study.md": "# The study\n\nWhat it found.\n",
  });
  const out = mkdtempSync(join(tmpdir(), "grooph-site-out-"));
  try {
    const r = run(root, "--out", out);
    assert.equal(r.status, 0, r.stderr);
    const files = [
      "docs/index.html",
      "docs/quickstart/index.html",
      "docs/rules/index.html",
      "docs/field-guide/index.html",
      "docs/field-guide/a.svg",
      "docs/blog/2026-10-05-hello/index.html",
      "docs/blog/2026-10-05-hello/a.svg",
      "docs/blog/2026-10-01-earlier/index.html",
      "docs/report/study/index.html",
    ];
    for (const f of files) assert.ok(existsSync(join(out, f)), f);
    assert.ok(!existsSync(join(out, "docs/blog/README/index.html")));
    const index = readFileSync(join(out, "docs/index.html"), "utf8");
    for (const heading of ["Start", "Reference", "Field guide", "Writing", "Blog", "Reports"]) assert.match(index, new RegExp(`<h[23] id="[^"]+">${heading}</h[23]>`), heading);
    // Newest post first; every group's pages are cards that link to their folders.
    assert.ok(index.indexOf('href="blog/2026-10-05-hello/"') < index.indexOf('href="blog/2026-10-01-earlier/"'));
    const post = readFileSync(join(out, "docs/blog/2026-10-05-hello/index.html"), "utf8");
    assert.match(post, /<img src="a\.svg" alt="A">/);
    assert.match(post, /<a class="site-logo" href="\.\.\/\.\.\/\.\.\/"><svg[^>]*>.*?<\/svg><span>grooph<\/span><\/a>/);
    assert.match(post, /<a href="\.\.\/\.\.\/#blog" aria-current="page">Blog<\/a>/);
    assert.match(post, /<a href="\.\.\/\.\.\/field-guide\/">Field guide<\/a>/);
    // The title stands in the band at the top with the section it belongs to; the column under it starts after it.
    assert.match(post, /<div class="page-hero"><div class="site-wrap">\n<p class="page-chip">Blog<\/p>\n<h1[^>]*>Hello<\/h1>\n<p>The first post\.<\/p>\n<\/div><\/div>/);
    assert.equal(post.match(/<h1/g).length, 1);
    const guide = readFileSync(join(out, "docs/field-guide/index.html"), "utf8");
    assert.match(guide, /<img src="a\.svg" alt="A" loading="lazy" decoding="async">/);
    assert.match(guide, /href="\.\.\/blog\/2026-10-05-hello\/"/);
    // The same tree passes the check, links between the pages and their images included.
    assert.equal(run(root, "--check").status, 0, run(root, "--check").stderr);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(out, { recursive: true, force: true });
  }
});

test("without a field guide or posts there is no header link to them and no group for them", () => {
  const root = tree({ "docs/quickstart.md": QUICKSTART, "docs/rules.md": RULES });
  const out = mkdtempSync(join(tmpdir(), "grooph-site-out-"));
  try {
    assert.equal(run(root, "--out", out).status, 0);
    const index = readFileSync(join(out, "docs/index.html"), "utf8");
    assert.doesNotMatch(index, /Field guide|Writing|#blog/);
    assert.match(index, /<li><a href="\.\/" aria-current="page">Docs<\/a><\/li><li><a href="https:\/\/github\.com\/ryanjosephkamp\/grooph" rel="noopener">Source/);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(out, { recursive: true, force: true });
  }
});

test("--out refuses to write into the repository's own docs folder", () => {
  const root = tree({ "docs/quickstart.md": QUICKSTART });
  try {
    const r = run(root, "--out", root);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /would write into the repository's own docs\/ folder/);
    assert.ok(!existsSync(join(root, "docs", "index.html")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a picture a page links to is a file of the site, and the front page's links into the documents must exist", () => {
  // The field guide links to its poster; the app's front page links to the same address. Both are the site's own file.
  const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
  const front = (address) => `export const x = <a href={\`\${DOCS}${address}\`}>there</a>;\n`;
  const files = { "docs/quickstart.md": "# Quickstart\n\nStart. [The poster](pictures/poster.png).\n", "docs/pictures/poster.png": PNG };
  const good = tree({ ...files, "apps/web/src/ui/landing/Landing.tsx": front("quickstart/poster.png") + front("quickstart/") });
  const out = mkdtempSync(join(tmpdir(), "grooph-site-out-"));
  try {
    assert.equal(run(good, "--check").status, 0, run(good, "--check").stderr);
    assert.equal(run(good, "--out", out).status, 0);
    assert.ok(existsSync(join(out, "docs", "quickstart", "poster.png")), "the linked picture is copied beside its page");
    assert.match(readFileSync(join(out, "docs", "quickstart", "index.html"), "utf8"), /href="poster\.png"/);
  } finally {
    rmSync(good, { recursive: true, force: true });
    rmSync(out, { recursive: true, force: true });
  }
  const bad = check({ ...files, "apps/web/src/ui/landing/Landing.tsx": front("field-guide/poster.svg") });
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /the front page links to docs\/field-guide\/poster\.svg, which the site does not have/);
});

test("the footer is the owner's on every page, and the same as the front page's: his five links in his order, the sponsor button, the themes", () => {
  const root = tree({ "docs/quickstart.md": QUICKSTART, "docs/rules.md": RULES });
  const out = mkdtempSync(join(tmpdir(), "grooph-site-out-"));
  try {
    assert.equal(run(root, "--out", out).status, 0);
    const front = readFileSync(join(repo, "apps", "web", "src", "ui", "landing", "Chrome.tsx"), "utf8");
    const LINKS = [
      ["https://ryanjosephkamp.github.io/", "Ryan Kamp’s website"],
      ["https://github.com/ryanjosephkamp/", "Ryan Kamp on GitHub"],
      ["https://www.linkedin.com/in/rjk1999", "Ryan Kamp on LinkedIn"],
      ["https://x.com/ryanjosephkamp", "Ryan Kamp on X"],
      ["https://m.youtube.com/@RyanJosephKamp", "Ryan Kamp on YouTube"],
    ];
    for (const name of ["docs/index.html", "docs/quickstart/index.html"]) {
      const page = readFileSync(join(out, name), "utf8");
      const foot = page.slice(page.indexOf('<footer class="site-footer">'));
      assert.match(foot, /Made by <a href="https:\/\/ryanjosephkamp\.github\.io\/">Ryan Kamp<\/a>/, name);
      const social = [...foot.matchAll(/<li><a href="([^"]+)" aria-label="([^"]+)" title="[^"]+"><svg/g)].map((m) => [m[1], m[2]]);
      assert.deepEqual(social, LINKS, name);
      assert.match(foot, /<a class="site-sponsor" href="https:\/\/github\.com\/sponsors\/ryanjosephkamp"><svg[^>]*>.*?<\/svg>Sponsor on GitHub<\/a>/, name);
      for (const words of ["Every feature is free; sponsorship is optional and never unlocks anything.", "MIT license, © 2026 Ryan Kamp.", "This site uses no cookies, analytics or third-party requests.", "Fonts: Atkinson Hyperlegible Next and Mono, SIL Open Font License."]) assert.ok(foot.includes(words), `${name}: ${words}`);
      assert.match(foot, /<a href="https:\/\/github\.com\/ryanjosephkamp\/grooph#license-and-author" rel="noopener">Credits<\/a>/, name);
    }
    // The front page's component carries the same five, in the same order, and the same small print.
    const theirs = [...front.matchAll(/\{ href: "([^"]+)", name: "([^"]+)", title: "[^"]+"/g)].map((m) => [m[1], m[2]]);
    assert.deepEqual(theirs, LINKS);
    assert.ok(front.includes('href="https://github.com/sponsors/ryanjosephkamp"'));
    assert.ok(front.includes("Every feature is free; sponsorship is optional and never unlocks anything. MIT license, © 2026 Ryan Kamp. This site uses no cookies, analytics or"));
    // One list of themes in three places: the front page's menu, the script in its page, and the document pages.
    const ids = (text) => [...text.matchAll(/\{ id: "([\w-]+)", label: "[^"]+", dot: "[^"]+" \}/g)].map((m) => m[1]);
    const layout = readFileSync(join(repo, "scripts", "site", "layout.mjs"), "utf8");
    assert.deepEqual(ids(front), ids(layout));
    assert.ok(ids(layout).length >= 2);
    const appPage = readFileSync(join(repo, "apps", "web", "index.html"), "utf8");
    assert.ok(appPage.includes(`const ids = ${JSON.stringify(ids(layout)).replace(/,/g, ", ")};`), "apps/web/index.html applies the same themes");
    const index = readFileSync(join(out, "docs/index.html"), "utf8");
    for (const id of ids(layout)) assert.ok(index.includes(`data-theme-id="${id}"`), id);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(out, { recursive: true, force: true });
  }
});

test("a page asks no other origin for anything: its style and script are inline, and its fonts are files of the site", () => {
  const root = tree({ "docs/quickstart.md": QUICKSTART, "docs/rules.md": RULES });
  const out = mkdtempSync(join(tmpdir(), "grooph-site-out-"));
  try {
    assert.equal(run(root, "--out", out).status, 0);
    const page = readFileSync(join(out, "docs", "quickstart", "index.html"), "utf8");
    // Everything a browser would fetch for the page: a src, a stylesheet or preload link, a url() in the style.
    const fetched = [...page.matchAll(/\ssrc="([^"]+)"/g), ...page.matchAll(/<link rel="(?:stylesheet|preload|icon)" href="([^"]+)"/g), ...page.matchAll(/url\("([^"]+)"\)/g)].map((m) => m[1]);
    assert.ok(fetched.length >= 4, "the icon, the preload and three fonts");
    for (const address of fetched) assert.doesNotMatch(address, /^(?:[a-z]+:)?\/\//i, address);
    const fonts = fetched.filter((a) => a.endsWith(".woff2"));
    assert.deepEqual([...new Set(fonts)].sort(), ["../../assets/fonts/atkinson-hyperlegible-mono.v1.woff2", "../../assets/fonts/atkinson-hyperlegible-next-italic.v1.woff2", "../../assets/fonts/atkinson-hyperlegible-next.v1.woff2"]);
    for (const font of new Set(fonts)) assert.ok(existsSync(join(repo, "apps", "web", "public", font.replace("../../", ""))), font);
    for (const license of ["OFL-atkinson-hyperlegible-next.txt", "OFL-atkinson-hyperlegible-mono.txt"]) assert.ok(existsSync(join(repo, "apps", "web", "public", "assets", "fonts", license)), license);
    assert.equal((page.match(/font-display:swap/g) ?? []).length, 3);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(out, { recursive: true, force: true });
  }
});

test("--check fails when the app has a theme the pages do not carry", () => {
  const root = tree({ "docs/quickstart.md": QUICKSTART, "docs/rules.md": RULES });
  try {
    const css = join(root, "apps", "web", "src", "styles.css");
    writeFileSync(css, `${readFileSync(css, "utf8")}\n:root[data-theme="ember"] {\n  --accent: #a33;\n}\n`);
    const r = run(root, "--check");
    assert.equal(r.status, 1);
    assert.match(r.stderr, /the app's variables for ember, light are not here/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a long picture with a shorter view beside it is shown short and opens whole; a link to it is still to all of it", () => {
  const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>';
  const root = tree({
    "docs/quickstart.md": '# Quickstart\n\nThe map:\n\n<img src="pictures/map.light.svg" alt="The map" width="400">\n\nAnd ![another](pictures/plain.svg), and [the map itself](pictures/map.light.svg).\n',
    "docs/pictures/map.light.svg": SVG,
    "docs/pictures/map.light.short.svg": SVG,
    "docs/pictures/plain.svg": SVG,
  });
  const out = mkdtempSync(join(tmpdir(), "grooph-site-out-"));
  try {
    assert.equal(run(root, "--out", out).status, 0);
    const page = readFileSync(join(out, "docs", "quickstart", "index.html"), "utf8");
    assert.match(page, /<a class="whole" href="map\.light\.svg"><img src="map\.light\.short\.svg" alt="The map" width="400"><span>The whole picture<\/span><\/a>/);
    assert.match(page, /<img src="plain\.svg" alt="another" loading="lazy" decoding="async">/);
    assert.match(page, /<a href="map\.light\.svg">the map itself<\/a>/);
    for (const name of ["map.light.svg", "map.light.short.svg", "plain.svg"]) assert.ok(existsSync(join(out, "docs", "quickstart", name)), name);
    assert.equal(run(root, "--check").status, 0, run(root, "--check").stderr);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(out, { recursive: true, force: true });
  }
});

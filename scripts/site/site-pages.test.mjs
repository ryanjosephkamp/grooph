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
    assert.match(post, /<a class="wordmark" href="\.\.\/\.\.\/\.\.\/">grooph<\/a>/);
    assert.match(post, /<a href="\.\.\/\.\.\/#blog" aria-current="page">Blog<\/a>/);
    assert.match(post, /<a href="\.\.\/\.\.\/field-guide\/">Field guide<\/a>/);
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
    assert.match(index, /<a href="\.\/" aria-current="page">Docs<\/a><a href="https:\/\/github\.com\/ryanjosephkamp\/grooph"/);
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

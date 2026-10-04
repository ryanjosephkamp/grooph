// The site's Markdown renderer (handoff 0060, criterion 3). Run with: node --test scripts/site/markdown.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";

import { renderMarkdown } from "./markdown.mjs";

const html = (md, options) => renderMarkdown(md, options).html;
const lines = (text) => text.replace(/^\n/, "");

test("headings carry GitHub's anchors, repeats are numbered, and the first level-one heading is the title", () => {
  const r = renderMarkdown(lines(`
# The title

## 1. Shape

## \`E_SCHEMA\` and more

## 1. Shape ##

Setext
------
`));
  assert.equal(r.title, "The title");
  assert.deepEqual(
    r.headings.map((h) => h.id),
    ["the-title", "1-shape", "e_schema-and-more", "1-shape-1", "setext"],
  );
  assert.match(r.html, /<h2 id="1-shape">1\. Shape<a class="anchor" href="#1-shape" aria-label="Link to this section">#<\/a><\/h2>/);
  assert.match(r.html, /<h1 id="the-title">The title<\/h1>/);
});

test("emphasis: stars and underscores, strong, both, and no emphasis inside a word or between spaces", () => {
  assert.equal(html("*a* **b** ***c*** _d_ __e__"), "<p><em>a</em> <strong>b</strong> <em><strong>c</strong></em> <em>d</em> <strong>e</strong></p>");
  assert.equal(html("snake_case_name and 2 * 3 * 4"), "<p>snake_case_name and 2 * 3 * 4</p>");
  assert.equal(html("a **bold *and em* text** b"), "<p>a <strong>bold <em>and em</em> text</strong> b</p>");
  assert.equal(html("~~gone~~ and ~one~"), "<p><del>gone</del> and ~one~</p>");
});

test("inline code, with backticks inside and angle brackets escaped", () => {
  assert.equal(html("`a <b> & c`"), "<p><code>a &lt;b&gt; &amp; c</code></p>");
  assert.equal(html("`` a ` b ``"), "<p><code>a ` b</code></p>");
});

test("links: inline, titled, with parentheses, by reference, autolinks, and bare URLs without their trailing period", () => {
  assert.equal(html('[x](a.md "T")'), '<p><a href="a.md" title="T">x</a></p>');
  assert.equal(html("[x](https://e.com/a_(b))"), '<p><a href="https://e.com/a_(b)" rel="noopener">x</a></p>');
  assert.equal(html("[x][r] and [r]\n\n[r]: https://e.com/ 'Title'"), '<p><a href="https://e.com/" title="Title" rel="noopener">x</a> and <a href="https://e.com/" title="Title" rel="noopener">r</a></p>');
  assert.equal(html("<https://e.com/a?b=1&c=2>"), '<p><a href="https://e.com/a?b=1&amp;c=2" rel="noopener">https://e.com/a?b=1&amp;c=2</a></p>');
  assert.equal(html("See https://e.com/x, and (https://e.com/y)."), '<p>See <a href="https://e.com/x" rel="noopener">https://e.com/x</a>, and (<a href="https://e.com/y" rel="noopener">https://e.com/y</a>).</p>');
  assert.equal(html("[a [b](c.md) d](e.md)"), '<p>[a <a href="c.md">b</a> d](e.md)</p>');
});

test("every address goes through link() and image(), in Markdown and in raw HTML", () => {
  const seen = [];
  const options = { link: (h) => (seen.push(`link ${h}`), `L(${h})`), image: (s) => (seen.push(`image ${s}`), `I(${s})`) };
  assert.equal(html("[x](a.md#b) ![alt](p/q.png)", options), '<p><a href="L(a.md#b)">x</a> <img src="I(p/q.png)" alt="alt" loading="lazy" decoding="async"></p>');
  const raw = html('<picture>\n<source media="(prefers-color-scheme: dark)" srcset="d.svg 1x, d2.svg 2x">\n<img src="l.svg" alt="x">\n</picture>\n\n<a href="z.md">z</a> <img src="i.png">', options);
  assert.match(raw, /srcset="I\(d\.svg\) 1x, I\(d2\.svg\) 2x"/);
  assert.match(raw, /<img src="I\(l\.svg\)" alt="x">/);
  assert.match(raw, /<a href="L\(z\.md\)">z<\/a> <img src="I\(i\.png\)">/);
});

test("raw HTML blocks pass through as written: picture, iframe, details with Markdown after a blank line, comments", () => {
  const picture = '<picture>\n  <source srcset="a.svg">\n  <img src="b.svg" alt="B">\n</picture>';
  assert.equal(html(picture), picture);
  const frame = '<iframe src="https://example.com/embed" width="600" height="300" title="A graph"></iframe>';
  assert.equal(html(`Before\n\n${frame}\n\nAfter`), `<p>Before</p>\n${frame}\n<p>After</p>`);
  const details = html("<details>\n<summary>More</summary>\n\nSome **bold** text.\n\n</details>");
  assert.equal(details, "<details>\n<summary>More</summary>\n<p>Some <strong>bold</strong> text.</p>\n</details>");
  assert.equal(html("<!-- note -->\n\ntext"), "<!-- note -->\n<p>text</p>");
  const script = '<script>window.x = "<b>";</script>';
  assert.equal(html(script), script);
});

test("a placeholder in angle brackets is text; a known inline tag stays a tag", () => {
  assert.equal(html("run <file> or <run dir> now"), "<p>run &lt;file&gt; or &lt;run dir&gt; now</p>");
  assert.equal(html("press <kbd>Esc</kbd><br>twice"), "<p>press <kbd>Esc</kbd><br>twice</p>");
  assert.equal(html("a &amp; b & c &copy; <3"), "<p>a &amp; b &amp; c &copy; &lt;3</p>");
});

test("fenced code keeps its text and names its language; a fence never closed runs to the end", () => {
  assert.equal(html("```bash\necho \"a\" && ls\n```"), '<div class="code" data-lang="bash"><pre tabindex="0"><code class="language-bash">echo &quot;a&quot; &amp;&amp; ls\n</code></pre></div>');
  assert.equal(html("~~~\n# not a heading\n- not a list\n~~~"), '<div class="code"><pre tabindex="0"><code># not a heading\n- not a list\n</code></pre></div>');
  assert.match(html("```json\n{ \"a\": 1 }\n\nstill code"), /still code\n<\/code>/);
  assert.match(html("    indented\n      more"), /<code>indented\n {2}more\n<\/code>/);
});

test("lists: tight, loose, ordered from a number, two levels, task items, lazy lines", () => {
  assert.equal(html("- a\n- b\n- c"), "<ul>\n<li>a</li>\n<li>b</li>\n<li>c</li>\n</ul>");
  assert.equal(html("- a\n\n- b"), "<ul>\n<li>\n<p>a</p>\n</li>\n<li>\n<p>b</p>\n</li>\n</ul>");
  assert.equal(html("3. a\n4. b"), '<ol start="3">\n<li>a</li>\n<li>b</li>\n</ol>');
  assert.equal(html("1. a\n2. b"), "<ol>\n<li>a</li>\n<li>b</li>\n</ol>");
  assert.equal(html("- a\n  - b\n    - c\n- d"), "<ul>\n<li>a\n<ul>\n<li>b\n<ul>\n<li>c</li>\n</ul></li>\n</ul></li>\n<li>d</li>\n</ul>");
  assert.equal(html("1. a\n   - b\n2. c"), "<ol>\n<li>a\n<ul>\n<li>b</li>\n</ul></li>\n<li>c</li>\n</ol>");
  assert.equal(html("- [ ] todo\n- [x] done"), '<ul>\n<li class="task"><input type="checkbox" disabled> todo</li>\n<li class="task"><input type="checkbox" disabled checked> done</li>\n</ul>');
  assert.equal(html("- first line\ncontinues here\n- next"), "<ul>\n<li>first line\ncontinues here</li>\n<li>next</li>\n</ul>");
  assert.equal(html("- `a` first\ncontinues\n- b"), "<ul>\n<li><code>a</code> first\ncontinues</li>\n<li>b</li>\n</ul>");
});

test("a fenced block and a paragraph inside a list item belong to the item", () => {
  const out = html("1. Run:\n\n   ```bash\n   pnpm test\n   ```\n\n2. Then stop.");
  assert.match(out, /<li>\n<p>Run:<\/p>\n<div class="code" data-lang="bash"><pre tabindex="0"><code class="language-bash">pnpm test\n<\/code><\/pre><\/div>\n<\/li>/);
  assert.match(out, /<li>\n<p>Then stop\.<\/p>\n<\/li>/);
});

test("a bullet marker starting a line of a different kind starts a new list; a rule is not a list item", () => {
  assert.equal(html("- a\n* b"), "<ul>\n<li>a</li>\n</ul>\n<ul>\n<li>b</li>\n</ul>");
  assert.equal(html("text\n\n---\n\nmore"), "<p>text</p>\n<hr>\n<p>more</p>");
  assert.equal(html("* * *"), "<hr>");
});

test("tables: alignment, escaped pipes, a short row padded, inline markup in cells, and the table ends at a blank line", () => {
  const out = html(lines(`
| Name | Qty | Note |
|:-----|----:|:----:|
| \`a\\|b\` | 1 | **x** |
| c | 2 |
after
`));
  assert.match(out, /<th>Name<\/th><th class="al-right">Qty<\/th><th class="al-center">Note<\/th>/);
  assert.match(out, /<td><code>a\|b<\/code><\/td><td class="al-right">1<\/td><td class="al-center"><strong>x<\/strong><\/td>/);
  assert.match(out, /<td>c<\/td><td class="al-right">2<\/td><td class="al-center"><\/td>/);
  assert.match(out, /<div class="table-wrap" tabindex="0"><table>/);
  assert.match(out, /<\/table><\/div>\n<p>after<\/p>/);
  assert.equal(renderMarkdown("| a | b |\n|---|---|\n| 1 | 2 |").diagnostics.length, 0);
});

test("a table can follow a paragraph line directly, and a row with too many cells is reported", () => {
  const out = renderMarkdown("Intro\n| a | b |\n|---|---|\n| 1 | 2 | 3 |");
  assert.match(out.html, /^<p>Intro<\/p>\n<div class="table-wrap"/);
  assert.match(out.diagnostics[0].message, /3 cells under 2 headings/);
});

test("blockquotes nest and continue lazily; GitHub's alerts get a title", () => {
  assert.equal(html("> a\n> b\n\n> c"), "<blockquote>\n<p>a\nb</p>\n</blockquote>\n<blockquote>\n<p>c</p>\n</blockquote>");
  assert.equal(html("> a\ncontinued"), "<blockquote>\n<p>a\ncontinued</p>\n</blockquote>");
  assert.equal(html("> outer\n>\n> > inner"), "<blockquote>\n<p>outer</p>\n<blockquote>\n<p>inner</p>\n</blockquote>\n</blockquote>");
  assert.equal(html("> [!NOTE]\n> Read this."), '<blockquote class="alert alert-note"><p class="alert-title">Note</p>\n<p>Read this.</p>\n</blockquote>');
});

test("hard breaks: two spaces or a backslash; soft breaks stay newlines", () => {
  assert.equal(html("a  \nb\\\nc\nd"), "<p>a<br>\nb<br>\nc\nd</p>");
});

test("backslash escapes and entities", () => {
  assert.equal(html("\\*not em\\* and \\[x\\]"), "<p>*not em* and [x]</p>");
});

test("the first paragraph is kept as a summary, and reference definitions are not shown", () => {
  const r = renderMarkdown("# T\n\n[r]: https://e.com/\n\nFirst **paragraph** here.\n\nSecond.");
  assert.equal(r.summary, "First paragraph here.");
  assert.doesNotMatch(r.html, /e\.com/);
});

test("Markdown the renderer could not use is reported with its line", () => {
  const stray = renderMarkdown("fine\n\nA **never closed\n\nand a `loose tick");
  assert.deepEqual(
    stray.diagnostics.map((d) => [d.line, d.message.split(":")[0]]),
    [
      [3, '"**" was left over'],
      [5, 'a "`" was left over'],
    ],
  );
  const pipes = renderMarkdown("| a | b |\n| 1 | 2 |");
  assert.match(pipes.diagnostics[0].message, /pipe rows outside a table/);
  assert.match(renderMarkdown("see [x](nope").diagnostics[0].message, /"\]\(" was left over/);
  assert.match(renderMarkdown("a[^1]").diagnostics[0].message, /footnotes/);
  assert.equal(renderMarkdown("a * b ** c and __init__ and `**`").diagnostics.length, 0);
});

test("a paragraph is not a table without a delimiter row, and a code block is never scanned for Markdown", () => {
  assert.equal(renderMarkdown("a | b | c").diagnostics.length, 0);
  assert.equal(renderMarkdown("```\n**oops `\n| a |\n| b |\n```").diagnostics.length, 0);
});

/**
 * A small Markdown renderer for the site's documents (handoff 0060). No dependency.
 *
 * It follows CommonMark where the documents need it and GitHub's additions where they use them: headings, paragraphs,
 * emphasis, inline code, links, images, fenced and indented code, bullet and numbered lists (nested), tables, blockquotes
 * (with GitHub's `[!NOTE]` alerts), rules, task lists, strikethrough, bare URLs, and raw HTML blocks passed through as
 * written. Raw HTML only has its relative addresses rewritten, so an image or a link in one still lands where it should.
 *
 * Two things beyond rendering:
 *   - `headings` carry GitHub's anchor ids, so `file.md#some-section` links keep working;
 *   - `diagnostics` list Markdown the renderer could not turn into anything: an emphasis mark that never closed, a code span
 *     that never ended, a pipe row that is not in a table. `site-pages.mjs --check` fails on them.
 *
 *   renderMarkdown(source, { link(href), image(src) }) → { html, title, headings, summary, diagnostics }
 *
 * `link` and `image` map a relative address in the source to the address the page uses; both are given every address in
 * the source, absolute ones included, and return it unchanged when it is not theirs to move.
 */

/** Type 6 HTML blocks (CommonMark): a line starting with one of these tags starts a raw block that runs to the next blank line. */
const BLOCK_TAGS = new Set(
  "address article aside base basefont blockquote body caption center col colgroup dd details dialog dir div dl dt fieldset figcaption figure footer form frame frameset h1 h2 h3 h4 h5 h6 head header hr html iframe legend li link main menu menuitem nav noframes ol optgroup option p param section source summary table tbody td tfoot th thead title tr track ul".split(
    " ",
  ),
);

/** Tags allowed inline. Anything else in angle brackets (`<file>`, `<run dir>`) is text, so a placeholder in prose shows as written. */
const INLINE_TAGS = new Set(
  "a abbr b bdi bdo br cite code data del details dfn em figcaption figure i img ins kbd mark picture q s samp small source span strong sub summary sup time u var wbr".split(
    " ",
  ),
);

const ATTR = String.raw`[A-Za-z_:][\w:.-]*(?:\s*=\s*(?:[^\s"'=<>\x60]+|'[^']*'|"[^"]*"))?`;
const OPEN_TAG = new RegExp(String.raw`^<([A-Za-z][A-Za-z0-9-]*)((?:\s+${ATTR})*)\s*(\/?)>`);
const CLOSE_TAG = /^<\/([A-Za-z][A-Za-z0-9-]*)\s*>/;
const TYPE7 = new RegExp(String.raw`^(?:<[A-Za-z][A-Za-z0-9-]*(?:\s+${ATTR})*\s*\/?>|<\/[A-Za-z][A-Za-z0-9-]*\s*>)\s*$`);

const ALERTS = { NOTE: "Note", TIP: "Tip", IMPORTANT: "Important", WARNING: "Warning", CAUTION: "Caution" };

// ─── small helpers ───────────────────────────────────────────────────────────

export const escapeHtml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
/** Text content: a valid character reference in the source stays one. */
const escapeText = (s) => s.replace(/&(?!(?:#[0-9]{1,7}|#[xX][0-9a-fA-F]{1,6}|[A-Za-z][A-Za-z0-9]{1,31});)/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escapeAttr = (s) => escapeText(s).replace(/"/g, "&quot;");

const isBlank = (s) => /^\s*$/.test(s);
const indentOf = (s) => /^ */.exec(s)[0].length;
const isHr = (s) => /^ {0,3}([-*_])(?: *\1){2,} *$/.test(s);
const PUNCT = /[!-/:-@[-`{-~\p{P}\p{S}]/u;
const ASCII_PUNCT = /[!-/:-@[-`{-~]/;

/** Leading tabs and spaces to spaces, to the next multiple of four. Tabs inside a line are left alone. */
function expandLeading(s) {
  const lead = /^[ \t]*/.exec(s)[0];
  if (!lead.includes("\t")) return s;
  let out = "";
  for (const ch of lead) out += ch === "\t" ? " ".repeat(4 - (out.length % 4)) : ch;
  return out + s.slice(lead.length);
}

function decodeEntities(s) {
  const named = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", mdash: "—", ndash: "–", hellip: "…" };
  return s.replace(/&(#[0-9]+|#[xX][0-9a-fA-F]+|[A-Za-z]+);/g, (whole, body) => {
    if (body[0] === "#") {
      const code = body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : whole;
    }
    return named[body] ?? whole;
  });
}

const stripTags = (html) => decodeEntities(html.replace(/<[^>]*>/g, ""));

/** GitHub's anchor for a heading: lower case, punctuation gone, spaces to hyphens; repeats get -1, -2. */
function headingId(text, taken) {
  const base =
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\p{M}\s_-]/gu, "")
      .trim()
      .replace(/\s/g, "-") || "section";
  const n = taken.get(base) ?? 0;
  taken.set(base, n + 1);
  return n === 0 ? base : `${base}-${n}`;
}

// ─── block structure ─────────────────────────────────────────────────────────

/** A list marker at the start of a line (up to three spaces in), or null. */
function listMarker(line) {
  const m = /^( {0,3})([-+*]|(\d{1,9})([.)]))( +|$)/.exec(line);
  if (!m) return null;
  const indent = m[1].length;
  const width = m[2].length;
  let rest = line.slice(m[0].length);
  let offset;
  if (rest === "") offset = indent + width + 1;
  else if (m[5].length >= 5) {
    offset = indent + width + 1;
    rest = " ".repeat(m[5].length - 1) + rest;
  } else offset = indent + width + m[5].length;
  return { indent, ordered: m[3] !== undefined, number: m[3] === undefined ? 0 : Number(m[3]), kind: m[4] ?? m[2], offset, rest };
}

/** The end condition of a raw HTML block starting at this line: a pattern, or null for "the next blank line"; undefined when it is not one. */
function htmlStart(s, inParagraph) {
  let m = /^<(script|pre|style|textarea)(?:\s|>|$)/i.exec(s);
  if (m) return { end: new RegExp(`</${m[1]}>`, "i") };
  if (s.startsWith("<!--")) return { end: /-->/ };
  if (s.startsWith("<?")) return { end: /\?>/ };
  if (/^<![A-Za-z]/.test(s)) return { end: />/ };
  if (s.startsWith("<![CDATA[")) return { end: /\]\]>/ };
  m = /^<\/?([A-Za-z][A-Za-z0-9]*)(?:\s|\/?>|$)/.exec(s);
  if (m && BLOCK_TAGS.has(m[1].toLowerCase())) return { end: null };
  if (!inParagraph && TYPE7.test(s)) return { end: null };
  return undefined;
}

/** Whether this line begins a block that can interrupt a paragraph (also: ends a lazy continuation). */
function startsBlock(line) {
  const ind = indentOf(line);
  if (ind >= 4) return false;
  const s = line.slice(ind);
  if (/^#{1,6}(?:\s|$)/.test(s)) return true;
  if (/^(?:`{3,}|~{3,})/.test(s)) return true;
  if (isHr(line)) return true;
  if (s.startsWith(">")) return true;
  const marker = listMarker(line);
  if (marker && marker.rest !== "" && (!marker.ordered || marker.number === 1)) return true;
  return htmlStart(s, true) !== undefined;
}

/** A line that can be the last of a paragraph, so the next unindented line may continue it lazily. */
const isParagraphText = (line) => !isBlank(line) && !/^\s*(?:#{1,6}(?:\s|$)|`{3,}|~{3,}|\|)/.test(line) && !isHr(line);

const delimiterRow = (line) => line.includes("|") && /^\s*\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?\s*$/.test(line);

/** The cells of a table row; `\|` is a literal pipe, as on GitHub. */
function splitRow(line) {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|") && !s.endsWith("\\|")) s = s.slice(0, -1);
  const cells = [];
  let cur = "";
  for (let k = 0; k < s.length; k += 1) {
    if (s[k] === "\\" && s[k + 1] === "|") {
      cur += "|";
      k += 1;
    } else if (s[k] === "|") {
      cells.push(cur.trim());
      cur = "";
    } else cur += s[k];
  }
  cells.push(cur.trim());
  return cells;
}

const REF_DEF = /^ {0,3}\[((?:[^\]\\]|\\.)+)\]:\s*(<[^>]*>|\S+)(?:\s+("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\((?:[^)\\]|\\.)*\)))?\s*$/;
const normalizeLabel = (s) => s.trim().replace(/\s+/g, " ").toLowerCase();
const unescapeMd = (s) => s.replace(/\\([!-/:-@[-`{-~])/g, "$1");

/** Turns lines into blocks. Reference definitions are taken out of paragraphs and kept in `ctx.refs`. */
function parseBlocks(lines, ctx) {
  const blocks = [];
  const n = lines.length;
  let i = 0;
  while (i < n) {
    const { text, no } = lines[i];
    if (isBlank(text)) {
      i += 1;
      continue;
    }
    const start = i;
    const ind = indentOf(text);

    // Indented code.
    if (ind >= 4) {
      const body = [];
      let j = i;
      while (j < n && (isBlank(lines[j].text) || indentOf(lines[j].text) >= 4)) {
        body.push(lines[j].text.slice(4));
        j += 1;
      }
      while (body.length > 0 && isBlank(body[body.length - 1])) body.pop();
      blocks.push({ t: "code", lang: "", text: body.join("\n"), no, start, end: i + body.length - 1 });
      i += body.length;
      continue;
    }

    const s = text.slice(ind);
    let m;

    // Fenced code.
    if ((m = /^(`{3,}|~{3,})(.*)$/.exec(s)) && !(m[1][0] === "`" && m[2].includes("`"))) {
      const fence = m[1];
      const close = new RegExp(`^ {0,3}${fence[0] === "`" ? "`" : "~"}{${fence.length},}\\s*$`);
      const body = [];
      let j = i + 1;
      while (j < n && !close.test(lines[j].text)) {
        const t = lines[j].text;
        body.push(t.slice(Math.min(ind, indentOf(t))));
        j += 1;
      }
      const info = m[2].trim();
      blocks.push({ t: "code", lang: info.split(/\s+/)[0] ?? "", text: body.join("\n"), no, start, end: Math.min(j, n - 1) });
      i = j + 1;
      continue;
    }

    // ATX heading.
    if ((m = /^(#{1,6})(?:\s+(.*))?$/.exec(s))) {
      const content = (m[2] ?? "").replace(/\s+#+\s*$/, "").replace(/^#+\s*$/, "").trim();
      blocks.push({ t: "heading", level: m[1].length, text: content, no, start, end: i });
      i += 1;
      continue;
    }

    // Thematic break.
    if (isHr(text)) {
      blocks.push({ t: "hr", no, start, end: i });
      i += 1;
      continue;
    }

    // Blockquote.
    if (s.startsWith(">")) {
      const inner = [];
      let j = i;
      let open = false;
      while (j < n) {
        const t = lines[j].text;
        if (isBlank(t)) break;
        const q = /^ {0,3}> ?/.exec(t);
        if (q) {
          const body = t.slice(q[0].length);
          if (/^(?:`{3,}|~{3,})/.test(body.trimStart())) open = !open;
          inner.push({ text: body, no: lines[j].no });
          j += 1;
          continue;
        }
        const prev = inner[inner.length - 1];
        if (prev && !open && isParagraphText(prev.text) && !startsBlock(t)) {
          inner.push({ text: t.trimStart(), no: lines[j].no });
          j += 1;
          continue;
        }
        break;
      }
      blocks.push({ t: "quote", children: parseBlocks(inner, ctx), no, start, end: j - 1 });
      i = j;
      continue;
    }

    // List.
    const marker = listMarker(text);
    if (marker) {
      const parsed = parseList(lines, i, ctx);
      blocks.push({ ...parsed.block, no, start, end: parsed.next - 1 });
      i = parsed.next;
      continue;
    }

    // Raw HTML.
    const html = htmlStart(s, false);
    if (html !== undefined) {
      const body = [];
      let j = i;
      if (html.end === null) {
        while (j < n && !isBlank(lines[j].text)) {
          body.push(lines[j].text);
          j += 1;
        }
      } else {
        while (j < n) {
          body.push(lines[j].text);
          j += 1;
          if (html.end.test(lines[j - 1].text)) break;
        }
      }
      blocks.push({ t: "html", text: body.join("\n"), no, start, end: j - 1 });
      i = j;
      continue;
    }

    // Table: a header row, then a delimiter row with as many cells.
    if (text.includes("|") && i + 1 < n && delimiterRow(lines[i + 1].text) && splitRow(text).length === splitRow(lines[i + 1].text).length) {
      const parsed = parseTable(lines, i);
      blocks.push({ ...parsed.block, no, start, end: parsed.next - 1 });
      i = parsed.next;
      continue;
    }

    // Paragraph, or a setext heading when the next line underlines it.
    const para = [lines[i]];
    let j = i + 1;
    let setext = 0;
    while (j < n) {
      const t = lines[j].text;
      if (isBlank(t)) break;
      if (indentOf(t) < 4) {
        if (/^ {0,3}=+\s*$/.test(t)) {
          setext = 1;
          j += 1;
          break;
        }
        if (/^ {0,3}-+\s*$/.test(t)) {
          setext = 2;
          j += 1;
          break;
        }
        if (startsBlock(t)) break;
        if (t.includes("|") && j + 1 < n && delimiterRow(lines[j + 1].text) && splitRow(t).length === splitRow(lines[j + 1].text).length) break;
      }
      para.push(lines[j]);
      j += 1;
    }
    if (setext > 0) {
      blocks.push({ t: "heading", level: setext, text: para.map((l) => l.text.trim()).join(" "), no, start, end: j - 1 });
      i = j;
      continue;
    }
    // Link reference definitions lead a paragraph; they are not shown.
    let first = 0;
    while (first < para.length) {
      const def = REF_DEF.exec(para[first].text);
      if (!def) break;
      const label = normalizeLabel(def[1]);
      if (!ctx.refs.has(label)) {
        const dest = def[2].startsWith("<") ? def[2].slice(1, -1) : def[2];
        ctx.refs.set(label, { href: unescapeMd(dest), title: def[3] ? unescapeMd(def[3].slice(1, -1)) : "" });
      }
      first += 1;
    }
    const rest = para.slice(first);
    // Leading spaces go; trailing ones stay on every line but the last, where two of them mean a hard break.
    if (rest.length > 0) blocks.push({ t: "p", lines: rest.map((l, k) => (k === rest.length - 1 ? l.text.trim() : l.text.trimStart())), no: rest[0].no, start: start + first, end: j - 1 });
    i = j;
  }
  return blocks;
}

function parseTable(lines, i) {
  const head = splitRow(lines[i].text);
  const align = splitRow(lines[i + 1].text).map((c) => (c.startsWith(":") && c.endsWith(":") ? "center" : c.endsWith(":") ? "right" : ""));
  const rows = [];
  let j = i + 2;
  while (j < lines.length) {
    const t = lines[j].text;
    if (isBlank(t) || !t.includes("|") || /^ {0,3}(?:#{1,6}\s|`{3}|~{3}|>)/.test(t) || isHr(t)) break;
    rows.push({ cells: splitRow(t), no: lines[j].no });
    j += 1;
  }
  return { block: { t: "table", head, align, rows }, next: j };
}

function parseList(lines, i, ctx) {
  const n = lines.length;
  const first = listMarker(lines[i].text);
  const items = [];
  let loose = false;
  let at = i;
  for (;;) {
    const marker = listMarker(lines[at].text);
    const itemLines = [{ text: marker.rest, no: lines[at].no }];
    let j = at + 1;
    let fenced = false;
    if (/^ {0,3}(?:`{3,}|~{3,})/.test(marker.rest)) fenced = true;
    while (j < n) {
      const t = lines[j].text;
      if (isBlank(t)) {
        let k = j;
        while (k < n && isBlank(lines[k].text)) k += 1;
        if (k < n && indentOf(lines[k].text) >= marker.offset && !(marker.rest === "" && itemLines.length === 1)) {
          for (; j < k; j += 1) itemLines.push({ text: "", no: lines[j].no });
          continue;
        }
        break;
      }
      if (indentOf(t) >= marker.offset) {
        const body = t.slice(marker.offset);
        if (/^ {0,3}(?:`{3,}|~{3,})/.test(body)) fenced = !fenced;
        itemLines.push({ text: body, no: lines[j].no });
        j += 1;
        continue;
      }
      // Lazy continuation: a line of paragraph text that does not start anything else.
      const prev = itemLines[itemLines.length - 1];
      if (!fenced && isParagraphText(prev.text) && !startsBlock(t) && !listMarker(t)) {
        itemLines.push({ text: t.trimStart(), no: lines[j].no });
        j += 1;
        continue;
      }
      break;
    }
    const children = parseBlocks(itemLines, ctx);
    // A blank line between two blocks of one item makes the list loose.
    for (let c = 1; c < children.length; c += 1) if (children[c].start > children[c - 1].end + 1) loose = true;
    items.push({ children });
    // The next item: the same kind of marker, after any blank lines.
    let k = j;
    while (k < n && isBlank(lines[k].text)) k += 1;
    const next = k < n ? listMarker(lines[k].text) : null;
    if (next && next.ordered === first.ordered && next.kind === first.kind && !isHr(lines[k].text)) {
      if (k > j) loose = true;
      at = k;
      continue;
    }
    return { block: { t: "list", ordered: first.ordered, from: first.number, loose, items }, next: j };
  }
}

// ─── inline ──────────────────────────────────────────────────────────────────

const URL_SCHEME = /^[A-Za-z][A-Za-z0-9+.-]{1,31}:/;

/** Parses `(destination "title")` at the start of `s` (just after a closing bracket). */
function parseLinkTail(s) {
  if (s[0] !== "(") return null;
  let i = 1;
  const skip = () => {
    while (i < s.length && /\s/.test(s[i])) i += 1;
  };
  skip();
  let href = "";
  if (s[i] === "<") {
    const end = s.indexOf(">", i);
    if (end < 0 || s.slice(i, end).includes("\n")) return null;
    href = s.slice(i + 1, end);
    i = end + 1;
  } else {
    let depth = 0;
    const from = i;
    while (i < s.length) {
      const c = s[i];
      if (c === "\\" && i + 1 < s.length) i += 2;
      else if (c === "(") {
        depth += 1;
        i += 1;
      } else if (c === ")") {
        if (depth === 0) break;
        depth -= 1;
        i += 1;
      } else if (/\s/.test(c)) break;
      else i += 1;
    }
    if (depth !== 0) return null;
    href = s.slice(from, i);
  }
  skip();
  let title = "";
  if (s[i] === '"' || s[i] === "'" || s[i] === "(") {
    const close = s[i] === "(" ? ")" : s[i];
    let j = i + 1;
    while (j < s.length && s[j] !== close) j += s[j] === "\\" ? 2 : 1;
    if (j >= s.length) return null;
    title = s.slice(i + 1, j);
    i = j + 1;
    skip();
  }
  if (s[i] !== ")") return null;
  return { href: unescapeMd(href), title: unescapeMd(title), length: i + 1 };
}

/** Trims what follows a bare URL but is not part of it: closing punctuation, an unbalanced parenthesis, an entity. */
function trimUrl(url) {
  for (;;) {
    const before = url;
    url = url.replace(/[?!.,:*_~'";]+$/, "");
    if (url.endsWith(")") && (url.match(/\(/g) ?? []).length < (url.match(/\)/g) ?? []).length) url = url.slice(0, -1);
    url = url.replace(/&[A-Za-z0-9]+;$/, "");
    if (url === before) return url;
  }
}

const MEDIA = new Set(["img", "source", "video", "audio", "track"]);

/**
 * Rewrites the relative addresses in raw HTML through the same two functions the Markdown uses: a link is a link, and a
 * picture or other media is one of the document's own files. An iframe or a script points where it says, and stays as written.
 */
function rewriteHtml(html, ctx) {
  return html.replace(/<([A-Za-z][A-Za-z0-9-]*)[^<>]*>/g, (tag, tagName) => {
    const element = tagName.toLowerCase();
    return tag.replace(/(\s)(src|href|poster|srcset)(\s*=\s*)("([^"]*)"|'([^']*)')/gi, (whole, space, name, eq, quoted) => {
      const value = quoted.slice(1, -1);
      const quote = quoted[0];
      const attr = name.toLowerCase();
      let next = value;
      if (attr === "href") {
        if (element === "a" || element === "area") next = ctx.link(decodeEntities(value));
      } else if (attr === "srcset") {
        if (MEDIA.has(element)) {
          next = value
            .split(",")
            .map((part) => {
              const [url, ...rest] = part.trim().split(/\s+/);
              return [ctx.image(decodeEntities(url)), ...rest].join(" ");
            })
            .join(", ");
        }
      } else if (MEDIA.has(element)) next = ctx.image(decodeEntities(value));
      return next === value ? whole : `${space}${name}${eq}${quote}${escapeAttr(next)}${quote}`;
    });
  });
}

/** Inline content to HTML. */
function renderInline(src, ctx) {
  const nodes = inlineNodes(src, ctx);
  processEmphasis(nodes);
  return serialize(nodes, ctx);
}

function serialize(nodes, ctx) {
  let out = "";
  for (let k = 0; k < nodes.length; k += 1) {
    const node = nodes[k];
    if (node.t === "raw") out += node.s;
    else if (node.t === "text") {
      if (ctx) {
        if (node.s.includes("`")) ctx.diagnose('a "`" was left over: a code span that never closed');
        if (node.s.includes("](")) ctx.diagnose('a "](" was left over: a link that did not parse');
        if (node.s.includes("[^") || (nodes[k - 1]?.t === "b" && !nodes[k - 1].image && node.s.startsWith("^"))) ctx.diagnose('"[^" was left over: footnotes are not rendered');
      }
      out += escapeText(node.s);
    } else if (node.t === "d") {
      // A pair that never closed. A lone star at the end of a word ("cost*") or between punctuation is text, not a lost mark.
      const lost = node.n >= 2 ? node.open || node.close : node.open && !node.close;
      if (node.n > 0 && lost && ctx) ctx.diagnose(`"${node.ch.repeat(node.n)}" was left over: an emphasis mark that never closed`);
      out += escapeText(node.ch.repeat(node.n));
    } else if (node.t === "b") {
      if (node.image && ctx) ctx.diagnose('"![" was left over: an image that did not parse');
      out += escapeText(node.s);
    }
  }
  return out;
}

function flanking(prev, next, ch) {
  const prevWs = prev === undefined || /\s/.test(prev);
  const nextWs = next === undefined || /\s/.test(next);
  const prevP = prev !== undefined && PUNCT.test(prev);
  const nextP = next !== undefined && PUNCT.test(next);
  const left = !nextWs && (!nextP || prevWs || prevP);
  const right = !prevWs && (!prevP || nextWs || nextP);
  if (ch === "_") return { open: left && (!right || prevP), close: right && (!left || nextP) };
  return { open: left, close: right };
}

function inlineNodes(s, ctx) {
  const nodes = [];
  const brackets = [];
  let text = "";
  const flush = () => {
    if (text) {
      nodes.push({ t: "text", s: text });
      text = "";
    }
  };
  let i = 0;
  while (i < s.length) {
    const c = s[i];

    if (c === "\\") {
      const next = s[i + 1];
      if (next !== undefined && ASCII_PUNCT.test(next)) {
        text += next;
        i += 2;
      } else if (next === "\n") {
        flush();
        nodes.push({ t: "raw", s: "<br>\n" });
        i += 2;
      } else {
        text += "\\";
        i += 1;
      }
      continue;
    }

    if (c === "`") {
      let k = 1;
      while (s[i + k] === "`") k += 1;
      let j = i + k;
      let close = -1;
      while (j < s.length) {
        if (s[j] === "`") {
          let r = 1;
          while (s[j + r] === "`") r += 1;
          if (r === k) {
            close = j;
            break;
          }
          j += r;
        } else j += 1;
      }
      if (close < 0) {
        text += "`".repeat(k);
        i += k;
        continue;
      }
      let code = s.slice(i + k, close).replace(/\n/g, " ");
      if (code.length > 2 && code.startsWith(" ") && code.endsWith(" ") && code.trim() !== "") code = code.slice(1, -1);
      flush();
      nodes.push({ t: "raw", s: `<code>${escapeText(code)}</code>` });
      i = close + k;
      continue;
    }

    if (c === "<") {
      const rest = s.slice(i);
      let m = /^<([A-Za-z][A-Za-z0-9+.-]{1,31}:[^\s<>]*)>/.exec(rest);
      if (m) {
        flush();
        nodes.push({ t: "raw", s: link(ctx, m[1], "", escapeText(m[1])) });
        i += m[0].length;
        continue;
      }
      m = /^<([A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)*)>/.exec(rest);
      if (m) {
        flush();
        nodes.push({ t: "raw", s: link(ctx, `mailto:${m[1]}`, "", escapeText(m[1])) });
        i += m[0].length;
        continue;
      }
      m = /^<!--[\s\S]*?-->/.exec(rest);
      if (m) {
        flush();
        nodes.push({ t: "raw", s: m[0] });
        i += m[0].length;
        continue;
      }
      m = OPEN_TAG.exec(rest) ?? CLOSE_TAG.exec(rest);
      if (m && INLINE_TAGS.has(m[1].toLowerCase())) {
        flush();
        nodes.push({ t: "raw", s: rewriteHtml(m[0], ctx) });
        i += m[0].length;
        continue;
      }
      text += "<";
      i += 1;
      continue;
    }

    if (c === "&") {
      const m = /^&(?:#[0-9]{1,7}|#[xX][0-9a-fA-F]{1,6}|[A-Za-z][A-Za-z0-9]{1,31});/.exec(s.slice(i, i + 40));
      if (m) {
        flush();
        nodes.push({ t: "raw", s: m[0] });
        i += m[0].length;
      } else {
        text += "&";
        i += 1;
      }
      continue;
    }

    if (c === "*" || c === "_" || c === "~") {
      let k = 1;
      while (s[i + k] === c) k += 1;
      if (c === "~" && k !== 2) {
        text += c.repeat(k);
        i += k;
        continue;
      }
      const { open, close } = flanking(s[i - 1], s[i + k], c);
      flush();
      nodes.push({ t: "d", ch: c, n: k, origN: k, open, close });
      i += k;
      continue;
    }

    if (c === "[" || (c === "!" && s[i + 1] === "[")) {
      flush();
      const image = c === "!";
      const node = { t: "b", s: image ? "![" : "[", image, active: true, after: i + (image ? 2 : 1) };
      nodes.push(node);
      brackets.push(node);
      i += image ? 2 : 1;
      continue;
    }

    if (c === "]") {
      const opener = brackets[brackets.length - 1];
      if (!opener) {
        text += "]";
        i += 1;
        continue;
      }
      if (!opener.active) {
        brackets.pop();
        text += "]";
        i += 1;
        continue;
      }
      let dest = null;
      let used = 0;
      const tail = parseLinkTail(s.slice(i + 1));
      if (tail) {
        dest = { href: tail.href, title: tail.title };
        used = tail.length;
      } else {
        const label = s.slice(opener.after, i);
        const full = /^\[((?:[^\]\\]|\\.)*)\]/.exec(s.slice(i + 1));
        const key = full ? (full[1].trim() === "" ? label : full[1]) : label;
        const ref = ctx.refs.get(normalizeLabel(key));
        if (ref && (full || /\S/.test(label))) {
          dest = ref;
          used = full ? full[0].length : 0;
        }
      }
      if (!dest) {
        brackets.pop();
        text += "]";
        i += 1;
        continue;
      }
      flush();
      const at = nodes.indexOf(opener);
      const inner = nodes.splice(at + 1);
      nodes.pop(); // the opener itself
      processEmphasis(inner);
      const inside = serialize(inner, ctx);
      if (opener.image) {
        nodes.push({ t: "raw", s: img(ctx, dest.href, stripTags(inside), dest.title) });
      } else {
        nodes.push({ t: "raw", s: link(ctx, dest.href, dest.title, inside) });
        for (const b of brackets) if (!b.image) b.active = false;
      }
      brackets.pop();
      i += 1 + used;
      continue;
    }

    if (c === "\n") {
      const hard = / {2,}$/.test(text);
      text = text.replace(/ +$/, "");
      if (hard) {
        flush();
        nodes.push({ t: "raw", s: "<br>\n" });
      } else text += "\n";
      i += 1;
      continue;
    }

    if ((c === "h" || c === "w") && brackets.length === 0 && (i === 0 || !/[A-Za-z0-9]/.test(s[i - 1]))) {
      const m = /^(?:https?:\/\/|www\.)[^\s<]+/.exec(s.slice(i));
      if (m) {
        const url = trimUrl(m[0]);
        if (/^(?:https?:\/\/)[^\s/?#]+\.[^\s/?#]+|^www\.[^\s/?#]+\.[^\s/?#]+/.test(url) || /^https?:\/\/localhost/.test(url)) {
          flush();
          nodes.push({ t: "raw", s: link(ctx, url.startsWith("www.") ? `http://${url}` : url, "", escapeText(url)) });
          i += url.length;
          continue;
        }
      }
    }

    text += c;
    i += 1;
  }
  flush();
  return nodes;
}

function link(ctx, href, title, inner) {
  const to = ctx.link(href);
  const external = /^https?:/i.test(to);
  return `<a href="${escapeAttr(to)}"${title ? ` title="${escapeAttr(title)}"` : ""}${external ? ' rel="noopener"' : ""}>${inner}</a>`;
}

function img(ctx, src, alt, title) {
  return `<img src="${escapeAttr(ctx.image(src))}" alt="${escapeAttr(alt)}"${title ? ` title="${escapeAttr(title)}"` : ""} loading="lazy" decoding="async">`;
}

/** CommonMark's emphasis algorithm over a node list: delimiter runs pair up from the inside out. Strikethrough is `~~` and needs equal runs. */
function processEmphasis(nodes) {
  let ci = 0;
  while (ci < nodes.length) {
    const closer = nodes[ci];
    if (closer.t !== "d" || !closer.close || closer.n === 0) {
      ci += 1;
      continue;
    }
    let found = -1;
    for (let oi = ci - 1; oi >= 0; oi -= 1) {
      const o = nodes[oi];
      if (o.t !== "d" || !o.open || o.ch !== closer.ch || o.n === 0) continue;
      if (closer.ch === "~") {
        found = oi;
        break;
      }
      // The rule of three: a run that can open and close does not pair when the lengths sum to a multiple of three.
      if ((o.close || closer.open) && (o.origN + closer.origN) % 3 === 0 && !(o.origN % 3 === 0 && closer.origN % 3 === 0)) continue;
      found = oi;
      break;
    }
    if (found < 0) {
      if (!closer.open) closer.close = false;
      ci += 1;
      continue;
    }
    const opener = nodes[found];
    const use = closer.ch === "~" ? 2 : opener.n >= 2 && closer.n >= 2 ? 2 : 1;
    const tag = closer.ch === "~" ? "del" : use === 2 ? "strong" : "em";
    const inner = nodes.slice(found + 1, ci);
    opener.n -= use;
    closer.n -= use;
    nodes.splice(found + 1, ci - found - 1, { t: "raw", s: `<${tag}>${serialize(inner, null)}</${tag}>` });
    ci = found + 2;
    if (opener.n === 0) {
      nodes.splice(found, 1);
      ci -= 1;
    }
    if (closer.n === 0) nodes.splice(ci, 1);
  }
}

// ─── rendering blocks ────────────────────────────────────────────────────────

function renderBlocks(blocks, ctx, tight) {
  return blocks.map((block) => renderBlock(block, ctx, tight)).filter((s) => s !== "").join("\n");
}

function renderBlock(block, ctx, tight) {
  ctx.line = block.no;
  switch (block.t) {
    case "heading": {
      const html = renderInline(block.text, ctx);
      const id = headingId(stripTags(html), ctx.ids);
      ctx.headings.push({ level: block.level, id, text: stripTags(html), html });
      const anchor = block.level > 1 ? `<a class="anchor" href="#${id}" aria-label="Link to ${escapeAttr(stripTags(html))}">#</a>` : "";
      return `<h${block.level} id="${id}">${html}${anchor}</h${block.level}>`;
    }
    case "p": {
      const source = block.lines.join("\n");
      // A paragraph made of pipe rows is a table that did not parse.
      if (block.lines.length >= 2 && block.lines.every((l) => /^\|.*\|$/.test(l))) ctx.diagnose("pipe rows outside a table (a table needs a header row, then a row of dashes)");
      const html = renderInline(source, ctx);
      // The summary is the first paragraph that reads as one; a byline or a date line is kept only if nothing longer follows.
      const plainText = stripTags(html).replace(/\s+/g, " ").trim();
      if (plainText !== "" && !/^<(?:img|picture)/.test(html)) {
        if (ctx.summary === null && plainText.length >= 60) ctx.summary = plainText;
        ctx.firstText ??= plainText;
      }
      // A line that is only an empty anchor, <a id="x"></a>, is a place to link to, not a paragraph.
      if (/^(?:<a\b[^>]*><\/a>\s*)+$/.test(html)) return html;
      return tight ? html : `<p>${html}</p>`;
    }
    case "code": {
      const lang = block.lang.replace(/[^\w+#.-]/g, "");
      const cls = lang ? ` class="language-${lang}"` : "";
      return `<div class="code"${lang ? ` data-lang="${lang}"` : ""}><pre tabindex="0"><code${cls}>${escapeHtml(block.text)}${block.text === "" ? "" : "\n"}</code></pre></div>`;
    }
    case "html":
      return rewriteHtml(block.text, ctx);
    case "hr":
      return "<hr>";
    case "quote": {
      const alert = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*$/i.exec(block.children[0]?.t === "p" ? block.children[0].lines[0] : "");
      if (alert) {
        const kind = alert[1].toUpperCase();
        const first = block.children[0];
        const children = first.lines.length > 1 ? [{ ...first, lines: first.lines.slice(1) }, ...block.children.slice(1)] : block.children.slice(1);
        return `<blockquote class="alert alert-${kind.toLowerCase()}"><p class="alert-title">${ALERTS[kind]}</p>\n${renderBlocks(children, ctx, false)}\n</blockquote>`;
      }
      return `<blockquote>\n${renderBlocks(block.children, ctx, false)}\n</blockquote>`;
    }
    case "list": {
      const tag = block.ordered ? "ol" : "ul";
      const open = block.ordered && block.from !== 1 ? ` start="${block.from}"` : "";
      const items = block.items.map((item) => renderItem(item, ctx, !block.loose)).join("\n");
      return `<${tag}${open}>\n${items}\n</${tag}>`;
    }
    case "table": {
      const cell = (tag, text, align) => `<${tag}${align ? ` class="al-${align}"` : ""}>${renderInline(text, ctx)}</${tag}>`;
      const head = block.head.map((text, k) => cell("th", text, block.align[k])).join("");
      const body = block.rows
        .map((row) => {
          ctx.line = row.no;
          if (row.cells.length > block.head.length) ctx.diagnose(`a table row has ${row.cells.length} cells under ${block.head.length} headings (an unescaped "|" inside a cell?)`);
          const cells = block.head.map((_, k) => cell("td", row.cells[k] ?? "", block.align[k]));
          return `<tr>${cells.join("")}</tr>`;
        })
        .join("\n");
      // Two or more columns that hold sentences or long code are given room to be read, and scroll on a phone; a table with one
      // long column and short labels beside it wraps to fit.
      const roomy = block.head.filter((_, k) => Math.max(...[block.head[k], ...block.rows.map((r) => r.cells[k] ?? "")].map((t) => t.replace(/[`*_]/g, "").length)) > 30).length >= 2;
      return `<div class="table-wrap" tabindex="0"><table${roomy ? ' class="wide"' : ""}>\n<thead><tr>${head}</tr></thead>\n<tbody>\n${body}\n</tbody>\n</table></div>`;
    }
    default:
      return "";
  }
}

function renderItem(item, ctx, tight) {
  let children = item.children;
  let task = "";
  const first = children[0];
  if (first?.t === "p") {
    const m = /^\[([ xX])\]\s+/.exec(first.lines[0]);
    if (m) {
      task = `<input type="checkbox" disabled${m[1] === " " ? "" : " checked"}> `;
      children = [{ ...first, lines: [first.lines[0].slice(m[0].length), ...first.lines.slice(1)] }, ...children.slice(1)];
    }
  }
  const parts = children.map((child) => renderBlock(child, ctx, tight)).filter((part) => part !== "");
  if (task && parts.length > 0) parts[0] = `${task}${parts[0]}`;
  // A tight item puts its text straight in the <li>; a loose one wraps each block in its own line.
  const text = tight ? parts.join("\n") : parts.length === 0 ? "" : `\n${parts.join("\n")}\n`;
  return `<li${task ? ' class="task"' : ""}>${text}</li>`;
}

/**
 * Renders a Markdown document.
 * @param {string} source
 * @param {{ link?: (href: string) => string, image?: (src: string) => string }} [options]
 */
export function renderMarkdown(source, options = {}) {
  const diagnostics = [];
  const ctx = {
    link: options.link ?? ((href) => href),
    image: options.image ?? ((src) => src),
    refs: new Map(),
    ids: new Map(),
    headings: [],
    summary: null,
    firstText: undefined,
    line: 1,
    diagnose(message) {
      diagnostics.push({ line: this.line, message });
    },
  };
  const lines = source
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((text, k) => ({ text: expandLeading(text), no: k + 1 }));
  const blocks = parseBlocks(lines, ctx);
  const html = renderBlocks(blocks, ctx, false);
  const h1 = ctx.headings.find((h) => h.level === 1);
  return { html, title: h1?.text ?? null, headings: ctx.headings, summary: ctx.summary ?? ctx.firstText ?? null, diagnostics };
}

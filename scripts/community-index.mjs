#!/usr/bin/env node
/**
 * The community gallery (handoff 0065): loop graphs, templates and operation maps that people send in by pull
 * request, checked and drawn with no one in the loop until the owner decides to merge. No backend (decision 0001).
 *
 * Documents live at community/<handle>/<id>.grooph.json (a graph or a template) or
 * community/<handle>/<id>.grooph-map.json (an operation map). This script reads each as data, validates it with
 * core, and generates, from those documents alone:
 *
 *   community/index.json                    one row per document: path, author, kind, name, summary, shape, credit, link
 *   community/pictures/<handle>/<id>.svg    the picture (the words on it), and <id>.glyph.svg, the wordless shape
 *   docs/community.md                       the gallery as a page, one entry per document
 *
 *   node scripts/community-index.mjs                       write them (refuses, and writes nothing, while a document fails)
 *   node scripts/community-index.mjs --check               exit 1 when a document fails or anything generated is stale (CI)
 *   node scripts/community-index.mjs --report [--changed <git rev> | --only <path>...] [--pictures <dir>] [--author <login>]
 *                                                          a Markdown report for a pull request's job summary: valid or not, with the
 *                                                          validator's own lines, for each document in scope. Exit 1 when one fails.
 *                                                          It does not fail for stale generated files (the owner regenerates those);
 *                                                          it says so. --pictures writes the pictures of the documents in scope there.
 *
 * Documents are only ever read: parsed as JSON, checked, drawn. Nothing in one is run. A `check` node's command, a
 * brief's instructions and a bash block in a summary are text for a harness to read much later, never for this script.
 * A symbolic link is never followed and a file over 256 KB is never read.
 *
 * A link opens a document in the app and is what `grooph share` makes: the same envelope, the same raw DEFLATE
 * and base64url. A template opens with its slot examples filled in, because `grooph share` refuses a template
 * (E_IS_TEMPLATE) and an unfilled one has nothing to look at. Compressors differ across machines and CPUs, so
 * the check compares a link by what it unpacks to, never by its bytes.
 *
 * Needs @grooph/core built (`pnpm -r build`, or `pnpm --filter @grooph/core build`).
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateRawSync, inflateRawSync } from "node:zlib";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const core = await import(join(root, "packages/core/dist/src/index.js")).catch(() => {
  console.error("community-index: @grooph/core is not built; run `pnpm -r build` first");
  process.exit(2);
});
const {
  SHARE_BASE,
  SHARE_LINK_WARN,
  buildShareEnvelope,
  encodeSharePayload,
  estimateShape,
  formatIssue,
  glyph,
  insertFragment,
  instantiate,
  isMapLike,
  mapPicture,
  mapShape,
  mapShapeLine,
  parseGraphText,
  parseMapText,
  picture,
  shapeLine,
  shareLink,
  slotKeys,
  validate,
  validateMap,
} = core;

// ─── what the repository says about itself ────────────────────────────────

const REPO = "ryanjosephkamp/grooph";
const RAW = `https://raw.githubusercontent.com/${REPO}/main/`;
const COMMUNITY = join(root, "community");
const PICTURES = join(COMMUNITY, "pictures");
const MAX_BYTES = 256 * 1024;
/** A GitHub handle: letters, digits and single hyphens, not at either end, at most 39 characters. */
const HANDLE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
const RESERVED = new Set(["pictures"]);
const DOCUMENT = /\.grooph(?:-map)?\.json$/i;
const DOCUMENT_NAME = /^([a-z][a-z0-9-]*)\.grooph(-map)?\.json$/;

const rel = (path) => relative(root, path).split(sep).join("/");
const sha = (text) => createHash("sha256").update(text).digest("hex");
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// ─── text that came from a document, made safe to print ───────────────────
// A summary, a name or a validator line is someone else's text. It lands in a Markdown page that a site renders,
// so it is put on one line, its HTML and link syntax is escaped, and a leading character that would make a block
// (a heading, a list, a fence) is escaped too. It never gets to start a line of its own.

const oneLine = (text) => String(text).replace(/\s+/g, " ").trim();
const md = (text) =>
  oneLine(text)
    .replace(/[\\<>&[\]]/g, (c) => ({ "\\": "\\\\", "<": "&lt;", ">": "&gt;", "&": "&amp;", "[": "\\[", "]": "\\]" })[c])
    .replace(/`{3,}|~{3,}/g, (run) => [...run].map((c) => `\\${c}`).join(""))
    .replace(/^([#>\-+*_=~|`])/, "\\$1")
    .replace(/^(\d+)([.)])/, "$1\\$2");
/** Text inside a double-quoted HTML attribute. */
const attr = (text) => oneLine(text).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
/** Inline code that survives backticks inside it. */
const code = (text) => {
  const body = oneLine(text);
  const longest = Math.max(0, ...(body.match(/`+/g) ?? []).map((run) => run.length));
  const tick = "`".repeat(longest + 1);
  return `${tick}${longest > 0 ? ` ${body} ` : body}${tick}`;
};
/** A fenced block whose fence is longer than any run of backticks inside it. */
const fence = (lines) => {
  const longest = Math.max(0, ...lines.flatMap((line) => (line.match(/`+/g) ?? []).map((run) => run.length)));
  const tick = "`".repeat(Math.max(3, longest + 1));
  return `${tick}text\n${lines.join("\n")}\n${tick}`;
};
const urlIn = (url) => url.replace(/[()<>"'`\\[\]|\s]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`);
const isWebUrl = (text) => {
  if (!/^https?:\/\/\S+$/.test(text)) return false;
  try {
    return ["http:", "https:"].includes(new URL(text).protocol);
  } catch {
    return false;
  }
};

// ─── links: what `grooph share` makes, compared by what they unpack to ────

const deflate = (bytes) => deflateRawSync(bytes, { level: 9 });
const LINK = /#\/open\?d=([A-Za-z0-9_-]+)/g;
const unpack = (payload) => {
  try {
    return inflateRawSync(Buffer.from(payload, "base64url"), { maxOutputLength: 4_000_000 }).toString("utf8");
  } catch {
    return undefined;
  }
};
/** Every link replaced by a digest of what it unpacks to, so two machines' compressors agree. */
const withLinksDigested = (text) =>
  text.replace(LINK, (_whole, payload) => {
    const body = unpack(payload);
    return `#/open?d=${body === undefined ? "undecodable" : `sha256-${sha(body)}`}`;
  });

// ─── reading the folder ───────────────────────────────────────────────────

/**
 * Every document under community/, and every path that is where a document should not be. Symbolic links are
 * reported and never followed; files that are not documents (a write-up, a README) are left alone.
 */
function scan() {
  const entries = [];
  const problems = [];
  const bad = (path, message) => problems.push({ path: rel(path), message });
  const list = (dir) => {
    try {
      return readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    } catch {
      return [];
    }
  };
  const nested = (dir, author) => {
    for (const item of list(dir)) {
      const path = join(dir, item.name);
      if (item.isSymbolicLink()) bad(path, "is a symbolic link; submissions are read as data and a link is never followed");
      else if (item.isDirectory()) nested(path, author);
      else if (DOCUMENT.test(item.name)) bad(path, `a document must sit directly in community/${author}/, not in a folder inside it`);
    }
  };

  for (const item of list(COMMUNITY)) {
    const path = join(COMMUNITY, item.name);
    if (item.isSymbolicLink()) bad(path, "is a symbolic link; submissions are read as data and a link is never followed");
    else if (item.isFile()) {
      if (DOCUMENT.test(item.name)) bad(path, "a document goes in a folder named for its author: community/<handle>/<id>.grooph.json");
    } else if (item.isDirectory() && !RESERVED.has(item.name)) {
      if (!HANDLE.test(item.name)) {
        bad(path, `"${item.name}" is not a GitHub handle (letters, digits and single hyphens); name the folder for yours`);
        continue;
      }
      for (const file of list(path)) {
        const filePath = join(path, file.name);
        if (file.isSymbolicLink()) bad(filePath, "is a symbolic link; submissions are read as data and a link is never followed");
        else if (file.isDirectory()) nested(filePath, item.name);
        else if (DOCUMENT.test(file.name)) {
          if (DOCUMENT_NAME.test(file.name)) entries.push({ rel: rel(filePath), abs: filePath, author: item.name, file: file.name });
          else bad(filePath, "name the file for the document's id, in lower-case kebab-case: <id>.grooph.json or <id>.grooph-map.json");
        }
      }
    }
  }
  return { entries, problems };
}

/** A repository path (the file a template's `demo` names) that stays inside the repository. */
const repoPath = (text) => !text.startsWith("/") && !text.split("/").includes("..") && !/[\\\0]/.test(text);

/** Read one document as data, check it, and work out everything the gallery shows of it. */
function load(entry) {
  const record = { path: entry.rel, author: entry.author, fileId: DOCUMENT_NAME.exec(entry.file)[1], problems: [], warnings: [] };
  const fail = (...lines) => record.problems.push(...lines);

  const size = lstatSync(entry.abs).size;
  if (size > MAX_BYTES) {
    fail(`error  community  the file is ${Math.ceil(size / 1024)} KB; documents over ${MAX_BYTES / 1024} KB are not read (the validator warns at about 24 KB already)`);
    return record;
  }
  const text = readFileSync(entry.abs, "utf8");
  let json;
  try {
    json = JSON.parse(text);
  } catch (err) {
    fail(`error  community  not JSON: ${err.message}`);
    return record;
  }

  const isMapFile = /\.grooph-map\.json$/i.test(entry.file);
  if (isMapLike(json) !== isMapFile) {
    fail(isMapFile ? "error  community  a .grooph-map.json file must hold an operation map (a `groophMap` document)" : "error  community  a .grooph.json file must hold a graph or a template, not an operation map");
    return record;
  }

  let issues = [];
  let shared; // what the link is made from: the document, or a template filled with its examples
  let drawn; // what the pictures are made from: that, or the template itself when it cannot be filled

  if (isMapFile) {
    const parsed = parseMapText(text);
    if (!parsed.map) {
      fail(...parsed.issues.map(formatIssue));
      return record;
    }
    const map = parsed.map;
    issues = validateMap(map);
    Object.assign(record, { kind: "map", id: map.id, name: map.name, summary: oneLine(map.description ?? ""), shape: mapShapeLine(mapShape(map)) });
    if (record.summary === "") fail("error  community  a map in the gallery needs a `description` that says what operation it draws");
    shared = drawn = map;
  } else {
    const parsed = parseGraphText(text);
    if (!parsed.doc) {
      fail(...parsed.issues.map(formatIssue));
      return record;
    }
    const doc = parsed.doc;
    record.id = doc.id;
    if (doc.template) {
      const block = doc.template;
      Object.assign(record, { kind: "template", templateKind: block.kind, name: block.title, summary: oneLine(block.summary) });
      if (record.summary === "") fail("error  community  a template needs a `template.summary`");

      // Every slot declared has a question and an example; every slot used is declared. Then the template is filled with
      // its examples, which is what the gallery opens and what the validator judges for export.
      const declared = (block.slots ?? []).map((slot) => slot.key);
      for (const slot of block.slots ?? []) {
        if (!slot.ask.trim() || !slot.example.trim()) fail(`error  community  slot "${slot.key}" needs both an ask and an example`);
      }
      for (const key of slotKeys(doc)) {
        if (!declared.includes(key)) fail(`error  community  {{${key}}} is used but template.slots does not declare it; a slot needs a question and an example`);
      }
      const values = Object.fromEntries((block.slots ?? []).map((slot) => [slot.key, slot.example]));
      const exampleName = `${block.title} (example values)`;
      let example;
      try {
        if (block.kind === "fragment") {
          const host = { grooph: 0, id: `${doc.id}-example`, name: exampleName, version: 1, goal: "Show the fragment.", target: { harness: "claude-code" }, nodes: [], edges: [], loops: [] };
          example = insertFragment(host, doc, { values }).doc;
        } else {
          example = instantiate(doc, { name: exampleName, values, id: `${doc.id}-example` });
        }
      } catch (err) {
        fail(`error  community  the template cannot be filled with its examples: ${err.message}`);
      }
      const own = validate(doc);
      const filled = example ? validate(example, { forExport: true }) : [];
      const seen = new Set();
      issues = [...own, ...filled].filter((issue) => {
        const key = `${issue.code}|${issue.at.join(",")}`;
        return seen.has(key) ? false : (seen.add(key), true);
      });
      drawn = example ?? doc;
      if (example) {
        shared = example;
        record.shape = shapeLine(estimateShape(example));
      }
      const credits = block.credits ?? [];
      for (const credit of credits) {
        if (!credit.name.trim() || !credit.note.trim() || !isWebUrl(credit.url)) fail(`error  community  a credit needs a name, a web link and a note on what was taken: ${oneLine(credit.name)}`);
      }
      if (credits.length > 0) record.credits = credits.map((c) => ({ name: oneLine(c.name), url: c.url, note: oneLine(c.note) }));
      record.proof = null;
      if (block.demo !== undefined && block.demo.trim() !== "") {
        const demo = block.demo.trim();
        if (isWebUrl(demo)) record.proof = demo;
        else if (repoPath(demo) && existsSync(join(root, demo))) record.proof = demo;
        else fail(`error  community  template.demo must be a web link or a file in this repository that exists: ${oneLine(demo)}`);
      }
    } else {
      issues = validate(doc, { forExport: true });
      Object.assign(record, { kind: "graph", name: doc.name, summary: oneLine(doc.description ?? doc.goal ?? ""), shape: shapeLine(estimateShape(doc)) });
      if (record.summary === "") fail("error  community  a graph needs a `description` or a `goal` that says what it is for");
      if (doc.lineage?.pattern) record.from = doc.lineage.pattern;
      shared = drawn = doc;
    }
  }

  if (record.id !== record.fileId) fail(`error  community  the file is named ${record.fileId} but the document's id is ${record.id}; name the file for the id`);
  for (const issue of issues) (issue.severity === "error" ? record.problems : record.warnings).push(formatIssue(issue));

  // The link, and the pictures. Pictures are drawn for anything that parsed, valid or not, so a sender can see what is wrong.
  if (drawn) {
    try {
      const isMap = record.kind === "map";
      const base = `community/pictures/${record.author}/${record.fileId}`;
      record.pictureFile = isMap ? `${base}.map.svg` : `${base}.svg`;
      record.pictureText = `${isMap ? mapPicture(drawn) : picture(drawn)}\n`;
      if (!isMap) {
        record.glyphFile = `${base}.glyph.svg`;
        record.glyphText = `${glyph(drawn)}\n`;
      }
    } catch (err) {
      fail(`error  community  the document could not be drawn: ${err.message}`);
    }
  }
  if (shared && record.problems.length === 0) {
    try {
      record.link = shareLink(encodeSharePayload(buildShareEnvelope(shared), deflate), SHARE_BASE);
      if (record.link.length > SHARE_LINK_WARN) record.warnings.push(`warning  community  the link to open it is ${record.link.length.toLocaleString("en")} characters; messengers often cut links over ${SHARE_LINK_WARN.toLocaleString("en")}`);
    } catch (err) {
      fail(`error  community  the document cannot be shared: ${err.message}`, ...(err.issues ?? []).map(formatIssue));
    }
  }
  record.ok = record.problems.length === 0;
  return record;
}

// ─── what is generated ────────────────────────────────────────────────────

const KIND_LABEL = { graph: "Graph", map: "Operation map", "template:graph": "Template", "template:fragment": "Template (a fragment, to insert into a graph)" };
const kindLabel = (r) => KIND_LABEL[r.kind === "template" ? `template:${r.templateKind}` : r.kind];

function indexRow(r) {
  return {
    path: r.path,
    author: r.author,
    kind: r.kind,
    ...(r.templateKind ? { templateKind: r.templateKind } : {}),
    id: r.id,
    name: r.name,
    summary: r.summary,
    shape: r.shape,
    ...(r.credits ? { credits: r.credits } : {}),
    ...(r.from ? { from: r.from } : {}),
    proof: r.proof ?? null,
    issues: r.warnings,
    ...(r.glyphFile ? { glyph: r.glyphFile } : {}),
    picture: r.pictureFile,
    link: r.link,
    raw: `${RAW}${r.path}`,
  };
}

function entryMarkdown(r) {
  const up = (path) => `../${urlIn(path)}`;
  const lines = [`## ${md(r.name)}`, ""];
  const shown = r.glyphFile ?? r.pictureFile;
  lines.push(`<img src="${up(shown)}" alt="The shape of ${attr(r.name)}" width="${r.glyphFile ? 260 : 320}">`, "");
  lines.push(`**${kindLabel(r)}** by ${code(r.author)} · _${r.proof ? "a proving run is linked by its author" : "no proving run linked"}_`, "");
  lines.push(`${md(r.summary)}`, "");
  lines.push(`- **Shape:** ${md(r.shape)}`);
  if (r.credits) lines.push(`- **Credit:** ${r.credits.map((c) => `[${md(c.name)}](${urlIn(c.url)}): ${md(c.note)}`).join("; ")}`);
  if (r.from) lines.push(`- **Starts from:** the built-in ${code(r.from)} template`);
  lines.push(
    r.proof
      ? `- **Proof:** linked by its author: [recorded run](${isWebUrl(r.proof) ? urlIn(r.proof) : up(r.proof)}). grooph has not checked what it shows.`
      : "- **Proof:** none linked. Nobody has recorded this running, so treat it as a design, not a result.",
  );
  lines.push(
    r.warnings.length === 0
      ? "- **Checked:** valid, no warnings."
      : `- **Checked:** valid, ${plural(r.warnings.length, "warning")}:\n${r.warnings.map((w) => `  - ${md(w)}`).join("\n")}`,
  );
  const openNote = r.kind === "template" ? " with the example values filled in" : "";
  lines.push(`- **Open:** [in the app${openNote}](${r.link}) · [the document](${up(r.path)}) · [the picture](${up(r.pictureFile)})`);
  // The command holds only the handle and the file name, which the folder rules limit to safe characters; nothing the author wrote.
  if (r.kind === "template") lines.push(`- **Use:** ${code(`grooph template add ${RAW}${r.path}`)}, then ${code(`grooph template use ${r.id} --name "My graph"`)}`);
  return lines.join("\n");
}

function galleryMarkdown(records) {
  const authors = new Set(records.map((r) => r.author)).size;
  const body = records.length === 0 ? "Nothing has been added yet. [How to send one](../community/README.md).\n" : records.map(entryMarkdown).join("\n\n") + "\n";
  return `# Community loops

Loop graphs, templates and operation maps that people sent in by pull request ([how to send one](../community/README.md)). Each is checked by grooph's own validator before it is listed, so each is a sound document: its loops have stops, its judgment loops have a bar, and nothing irreversible runs without a person. **That is all a listing says.** A community graph has no proving run unless one is linked in its entry; being listed does not mean it works, and grooph does not endorse it.

There is no backend and nothing is uploaded: the documents live in this repository under \`community/<handle>/\`, CI checks and draws every pull request, and this page is generated from what the owner has merged. ${records.length === 0 ? "" : `${plural(records.length, "document")} from ${plural(authors, "author")}.`}

${body}
_Generated by \`scripts/community-index.mjs\` from the documents under \`community/\`, like \`community/index.json\` and the pictures. Add a document, then run \`node scripts/community-index.mjs\`; CI fails when any of them is stale._
`;
}

function outputsFor(records) {
  const good = records.filter((r) => r.ok);
  const index = { groophCommunity: 0, documents: good.map(indexRow) };
  return [
    { path: join(COMMUNITY, "index.json"), text: `${JSON.stringify(index, null, 2)}\n`, digestLinks: true },
    { path: join(root, "docs", "community.md"), text: galleryMarkdown(good), digestLinks: true },
    ...good.flatMap((r) => [
      { path: join(root, r.pictureFile), text: r.pictureText },
      ...(r.glyphFile ? [{ path: join(root, r.glyphFile), text: r.glyphText }] : []),
    ]),
  ];
}

function filesBelow(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((item) => (item.isDirectory() ? filesBelow(join(dir, item.name)) : [join(dir, item.name)]));
}

/** Generated files that differ from what the documents say, and pictures left behind by a document that is gone. */
function staleness(outputs) {
  const stale = outputs
    .filter(({ path, text, digestLinks }) => {
      try {
        const current = readFileSync(path, "utf8");
        return digestLinks === true ? withLinksDigested(current) !== withLinksDigested(text) : current !== text;
      } catch {
        return true;
      }
    })
    .map(({ path }) => rel(path));
  const strays = filesBelow(PICTURES)
    .filter((path) => !outputs.some((o) => o.path === path))
    .map((path) => `${rel(path)} (no document)`);
  return [...stale, ...strays];
}

// ─── arguments ────────────────────────────────────────────────────────────

const USAGE = `usage: node scripts/community-index.mjs [--check | --report [--changed <git rev> | --only <path>...] [--pictures <dir>] [--author <login>]]`;
const args = process.argv.slice(2);
const flags = { check: false, report: false, changed: undefined, only: undefined, pictures: undefined, author: undefined };
for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === "--check") flags.check = true;
  else if (arg === "--report") flags.report = true;
  else if (arg === "--changed" || arg === "--pictures" || arg === "--author") {
    const value = args[(i += 1)];
    if (value === undefined || value.startsWith("--")) {
      console.error(`community-index: ${arg} needs a value\n${USAGE}`);
      process.exit(2);
    }
    flags[arg.slice(2)] = value;
  } else if (arg === "--only") {
    flags.only = [];
    while (args[i + 1] !== undefined && !args[i + 1].startsWith("--")) flags.only.push(args[(i += 1)]);
  } else if (arg === "--help" || arg === "-h") {
    console.log(USAGE);
    process.exit(0);
  } else {
    console.error(`community-index: unknown argument ${arg}\n${USAGE}`);
    process.exit(2);
  }
}
if (flags.check && flags.report) {
  console.error(`community-index: --check and --report are two modes; choose one\n${USAGE}`);
  process.exit(2);
}
if (!flags.report && (flags.changed !== undefined || flags.only !== undefined || flags.pictures !== undefined || flags.author !== undefined)) {
  console.error(`community-index: --changed, --only, --pictures and --author belong to --report\n${USAGE}`);
  process.exit(2);
}

// ─── run ──────────────────────────────────────────────────────────────────

const { entries, problems: structural } = scan();
const records = entries.map(load);

/** Failures as plain lines, grouped under the path they belong to. */
function failureLines(onlyPaths) {
  const keep = (path) => onlyPaths === undefined || onlyPaths.has(path);
  const lines = [];
  const paths = [...new Set([...records.filter((r) => !r.ok).map((r) => r.path), ...structural.map((p) => p.path)])].sort();
  for (const path of paths.filter(keep)) {
    lines.push(path);
    for (const r of records.filter((x) => x.path === path)) for (const line of r.problems) lines.push(`  ${line}`);
    for (const p of structural.filter((x) => x.path === path)) lines.push(`  error  community  ${p.message}`);
  }
  return lines;
}

if (flags.report) {
  // The scope: documents changed since a git revision, the paths named, or everything.
  let scope;
  let outside = [];
  let removed = [];
  if (flags.changed !== undefined) {
    if (!/^[A-Za-z0-9_./^~@{}][A-Za-z0-9_./^~@{}-]*$/.test(flags.changed)) {
      console.error(`community-index: "${flags.changed}" is not a git revision`);
      process.exit(2);
    }
    let names;
    try {
      names = execFileSync("git", ["diff", "--name-only", "--no-renames", "-z", flags.changed, "HEAD"], { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).split("\0").filter(Boolean);
    } catch (err) {
      console.error(`community-index: could not ask git what changed since ${flags.changed}: ${err.message}`);
      process.exit(2);
    }
    scope = new Set(names.filter((name) => name.startsWith("community/")));
    outside = names.filter((name) => !name.startsWith("community/"));
    removed = [...scope].filter((name) => DOCUMENT.test(name) && !existsSync(join(root, name)));
  } else if (flags.only !== undefined) {
    scope = new Set(flags.only.map((p) => rel(resolve(p))));
  }
  const inScope = (path) => scope === undefined || scope.has(path);

  const chosen = records.filter((r) => inScope(r.path));
  const misplaced = structural.filter((p) => inScope(p.path));
  const outputs = outputsFor(records);
  const stale = staleness(outputs);

  if (flags.pictures !== undefined) {
    for (const r of chosen) {
      for (const [file, text] of [[r.pictureFile, r.pictureText], [r.glyphFile, r.glyphText]]) {
        if (file === undefined || text === undefined) continue;
        const target = join(resolve(flags.pictures), file.slice("community/pictures/".length));
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, text, "utf8");
      }
    }
  }

  const bad = chosen.filter((r) => !r.ok).length + misplaced.length;
  const out = ["## Community submission check", ""];
  if (chosen.length === 0 && misplaced.length === 0 && removed.length === 0) {
    out.push(scope === undefined ? "There is no document under `community/` to check." : "No document under `community/` changed in this pull request, so there is nothing to check here.");
  } else {
    out.push(
      bad === 0
        ? `${chosen.length === 1 ? "The document" : `All ${chosen.length} documents`} checked ${chosen.length === 1 ? "is" : "are"} valid.`
        : `**${bad} of ${plural(chosen.length + misplaced.length, "item")} did not pass.** Each failure is listed below with the validator's own lines; an error blocks the document, a warning does not.`,
      "",
    );
    for (const r of chosen) {
      out.push(`### ${code(r.path)}: ${r.ok ? "valid" : "**not valid**"}`, "");
      if (r.kind) out.push(`${kindLabel(r)} · ${md(r.name)}${r.shape ? ` · ${md(r.shape)}` : ""}`, "");
      const lines = [...r.problems, ...r.warnings];
      out.push(lines.length === 0 ? "No issues." : fence(lines), "");
    }
    for (const p of misplaced) out.push(`### ${code(p.path)}: **not valid**`, "", fence([`error  community  ${p.message}`]), "");
    for (const path of removed) out.push(`### ${code(path)}: removed`, "", "The pull request deletes this document; it leaves the gallery when the generated files are refreshed.", "");
  }

  const notes = [];
  if (flags.author) {
    const login = flags.author.toLowerCase();
    const folders = [...new Set([...chosen.map((r) => r.author), ...misplaced.map((p) => p.path.split("/")[1]).filter(Boolean)])];
    const others = folders.filter((folder) => folder.toLowerCase() !== login);
    if (others.length > 0) notes.push(`${plural(others.length, "folder")} here ${others.length === 1 ? "is" : "are"} named for someone other than the pull request's author (${code(flags.author)}): ${others.map(code).join(", ")}. The name goes on the gallery page as the author, so the owner confirms it is right before merging.`);
  }
  if (outside.length > 0) {
    const shownNames = outside.slice(0, 8).map(code).join(", ");
    notes.push(`The pull request also changes ${plural(outside.length, "file")} outside \`community/\`, which this check does not look at: ${shownNames}${outside.length > 8 ? ", and more" : ""}.`);
  }
  notes.push(
    stale.length === 0
      ? "The generated gallery files are current."
      : "The generated gallery files (`community/index.json`, `community/pictures/`, `docs/community.md`) do not list this change yet. That does not block it: whoever merges runs `node scripts/community-index.mjs` and commits the result, and the sender may do it first.",
  );
  if (flags.pictures !== undefined) notes.push("The pictures of these documents are attached to this run as the `community-pictures` artifact.");
  out.push(...notes.map((note) => `- ${note}`), "");
  console.log(out.join("\n"));
  process.exit(bad > 0 ? 1 : 0);
}

const failures = failureLines(undefined);
if (failures.length > 0) {
  console.error(`community: ${plural(records.filter((r) => !r.ok).length + structural.length, "item")} did not pass\n${failures.join("\n")}`);
  if (!flags.check) console.error("nothing was written");
  process.exit(1);
}

const outputs = outputsFor(records);
if (flags.check) {
  const stale = staleness(outputs);
  if (stale.length > 0) {
    console.error(`stale: ${stale.join(", ")}; run \`node scripts/community-index.mjs\` and commit the result`);
    process.exit(1);
  }
  console.log(`community/index.json, community/pictures/ and docs/community.md are current (${plural(records.length, "document")})`);
} else {
  for (const { path, text } of outputs) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text, "utf8");
  }
  for (const path of filesBelow(PICTURES).filter((file) => !outputs.some((o) => o.path === file))) rmSync(path);
  // A folder left empty by a removed document goes with its pictures.
  if (existsSync(PICTURES)) {
    for (const item of readdirSync(PICTURES, { withFileTypes: true })) {
      if (item.isDirectory() && readdirSync(join(PICTURES, item.name)).length === 0) rmSync(join(PICTURES, item.name), { recursive: true });
    }
  }
  console.log(`wrote community/index.json, docs/community.md and ${outputs.length - 2} pictures (${plural(records.length, "document")})`);
}

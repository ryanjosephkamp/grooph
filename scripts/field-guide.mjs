#!/usr/bin/env node
/**
 * Generate the field guide to the loop shapes (slice 0059):
 *
 *   docs/field-guide.md          the guide: an introduction, then one section per template
 *   docs/field-guide/<id>.svg    each template's glyph, drawn by core's `glyph()`
 *   docs/field-guide/poster.svg  one portrait page: all the shapes, a legend, the app's address
 *
 *   node scripts/field-guide.mjs           write them
 *   node scripts/field-guide.mjs --check   exit 1 when any is stale or missing (CI)
 *
 * Nothing here is typed by hand per template. A template's words come from its
 * document and `patterns/index.json`; its shape line from core's `estimateShape`
 * and `shapeLine`, the source `grooph shape` uses; its glyph from `glyph`; its
 * proving record from `experiments/patterns/<id>/run/` read the way
 * `scripts/lib/prove-summary.mjs` reads it (the same `checkRun`), with the cost
 * taken from the spend ledger. A record that fails its check says so, with the
 * check's own findings (decision 0009); no sentence claims more than those
 * records hold (decision 0013).
 *
 * The poster is plain SVG on the app's light palette with no CSS variables, so
 * it opens the same in a browser, a viewer and a print dialog. Its text is
 * measured with core's own text helpers (the widest likely font), and a line
 * that would not fit stops the script instead of overflowing.
 *
 * Needs @grooph/core built (`pnpm -r build`).
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const patternsDir = join(root, "patterns");
const experimentsDir = join(root, "experiments", "patterns");
const guidePath = join(root, "docs", "field-guide.md");
const assetsDir = join(root, "docs", "field-guide");

const core = await import(join(root, "packages/core/dist/src/index.js")).catch(() => {
  console.error("field-guide: @grooph/core is not built; run `pnpm -r build` first");
  process.exit(2);
});
const draw = await import(join(root, "packages/core/dist/src/picture/svg.js"));
const { checkRun } = await import(join(root, "scripts/lib/prove-check.mjs"));
const { parseGraphText, formatIssue, estimateShape, shapeLine, glyph } = core;
const { inkFor, frame, text, rect, wrap, textWidth, truncate, fmt, esc } = draw;

const APP = "https://ryanjosephkamp.github.io/grooph";
const APP_HOST = "ryanjosephkamp.github.io/grooph";

// ─── what the guide is made from ───────────────────────────────────────────

const fail = (lines) => {
  console.error(lines.join("\n"));
  process.exit(1);
};

const problems = [];
const docs = new Map();
for (const file of readdirSync(patternsDir).filter((name) => name.endsWith(".grooph.json")).sort()) {
  const parsed = parseGraphText(readFileSync(join(patternsDir, file), "utf8"));
  if (!parsed.doc) {
    problems.push(`${file}: does not match the schema`, ...parsed.issues.map((issue) => `  ${formatIssue(issue)}`));
    continue;
  }
  if (!parsed.doc.template) problems.push(`${file}: has no template block, so it is not a pattern`);
  else docs.set(parsed.doc.id, { file, doc: parsed.doc });
}
const index = JSON.parse(readFileSync(join(patternsDir, "index.json"), "utf8"));
const rows = new Map(index.templates.map((row) => [row.id, row]));
for (const id of docs.keys()) if (!rows.has(id)) problems.push(`patterns/index.json has no row for ${id}; run \`node scripts/patterns-index.mjs\``);
for (const id of rows.keys()) if (!docs.has(id)) problems.push(`patterns/index.json lists ${id}, which has no document`);
if (problems.length > 0) fail(problems);

// Whole graphs first, fragments after; each group in the order of its ids.
const ids = [...docs.keys()].sort((a, b) => (rows.get(a).kind === rows.get(b).kind ? (a < b ? -1 : 1) : rows.get(a).kind === "graph" ? -1 : 1));

const ledger = JSON.parse(readFileSync(join(experimentsDir, "ledger.json"), "utf8"));
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

/** A finding as a person reads it: the note quoted at its end (`: {…}` or `(note 3: {…})`) is left to the evidence. */
const plain = (finding) => finding.split(/:\s*\{|\s*\(note \d+:/)[0].trim();

/** "Claude Code 2.1.278": result.json says `claude-code` and "2.1.278 (Claude Code)". */
function harnessWords(result) {
  const version = String(result.harness_version ?? "").replace(/\s*\([^)]*\)\s*$/, "");
  const name = result.harness === "claude-code" ? "Claude Code" : String(result.harness ?? "");
  return [name, version].filter(Boolean).join(" ");
}

/** A record's facts, as the proving check derives them (the same call `prove-summary.mjs` makes). */
async function record(id, dir) {
  const checked = await checkRun(dir, { core, template: id });
  const result = checked.result;
  if (!result) return { problems: checked.problems.map(plain) };
  const entries = ledger.invocations.filter((i) => i.template === id && (result.run_ids ?? []).includes(i.run_id) && i.status === "ok");
  const ledgerCost = entries.reduce((sum, i) => sum + i.cost_usd, 0);
  return {
    runId: result.run_id,
    harness: harnessWords(result),
    cost: entries.length > 0 ? ledgerCost : result.cost_usd,
    costDiffers: entries.length > 0 && Math.abs(ledgerCost - result.cost_usd) > 0.005 ? result.cost_usd : null,
    invocations: entries.map((i) => i.n),
    lastRound: checked.facts.last_round ?? null,
    back: checked.facts.back_edges,
    ending: checked.facts.ending ?? [],
    problems: checked.problems.map(plain),
  };
}

const records = new Map();
for (const id of ids) {
  const dir = join(experimentsDir, id, "run");
  if (!existsSync(join(dir, "result.json"))) {
    records.set(id, null);
    continue;
  }
  const kept = await record(id, dir);
  // Earlier runs kept beside the current one (run-1/ …): a re-proved template's history.
  const earlier = [];
  for (const name of readdirSync(join(experimentsDir, id)).filter((n) => /^run-\d+$/.test(n)).sort()) {
    if (existsSync(join(experimentsDir, id, name, "result.json"))) earlier.push({ name, ...(await record(id, join(experimentsDir, id, name))) });
  }
  records.set(id, { ...kept, earlier: earlier.filter((r) => r.runId && r.runId < kept.runId) });
}

// ─── words ─────────────────────────────────────────────────────────────────

const NUMBERS = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty".split(" ");
const numberWord = (n) => NUMBERS[n] ?? String(n);
const capital = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const money = (n) => `$${n.toFixed(2)}`;
const list = (items) => (items.length <= 2 ? items.join(" and ") : `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`);
const code = (s) => `\`${s}\``;

const title = (id) => rows.get(id).title;
const profileWords = (p) => `${p.cost} cost, ${p.speed} speed, ${p.rigor} rigor`;
const kindOf = (id) => rows.get(id).kind;
const slotKeys = (id) => (docs.get(id).doc.template.slots ?? []).map((s) => s.key);
const shapeOf = (id) => shapeLine(estimateShape(docs.get(id).doc));
const passed = (rec) => rec !== null && rec.problems.length === 0 && rec.runId !== undefined;

/** How a run ended, from the check's own readings: "stop node done", "stop bar-passed", "halt at merge-gate". */
function endingWords(ending) {
  const stopNodes = ending.flatMap((e) => /^stop node (.+)$/.exec(e)?.[1] ?? []);
  const halts = ending.flatMap((e) => /^halt at (.+)$/.exec(e)?.[1] ?? []);
  const stops = ending.flatMap((e) => (/^stop node /.test(e) ? [] : /^stop (.+)$/.exec(e)?.[1] ?? []));
  const other = ending.filter((e) => !/^(stop|halt at) /.test(e));
  const parts = [];
  if (halts.length > 0) parts.push(`halted at ${list(halts.map(code))}`);
  if (stopNodes.length > 0) parts.push(`at the stop node ${list(stopNodes.map(code))}`);
  if (stops.length > 0) parts.push(parts.length > 0 ? `the stop ${list(stops.map(code))} fired` : `on the stop ${list(stops.map(code))}`);
  parts.push(...other);
  return parts.length > 0 ? parts.join("; ") : "no ending was named";
}

function backEdgeWords(back) {
  if (!back) return "back edges were not recorded";
  if (!back.taken) return "no back edge was taken";
  const named = [...new Set([...(back.mentioned ?? []), ...(back.edge_notes ?? []).map((at) => String(at).replace(/^edge:/, ""))])];
  const who = (back.caught_by ?? []).length > 0 ? `, caught by ${list(back.caught_by)}` : "";
  return named.length > 0 ? `a back edge was taken (${list(named.map(code))})${who}` : `a back edge was taken in a later round${who}`;
}

function invocationWords(numbers) {
  if (numbers.length === 0) return "";
  return ` (ledger invocation${numbers.length > 1 ? "s" : ""} ${list(numbers.map(String))})`;
}

// ─── the glyphs ────────────────────────────────────────────────────────────

const GLYPH_SCALE = 1.5; // the files in docs/field-guide/ are a little larger than patterns/glyphs/
const glyphFiles = ids.map((id) => ({ id, path: join(assetsDir, `${id}.svg`), text: `${glyph(docs.get(id).doc, { scale: GLYPH_SCALE })}\n` }));

// ─── the guide ─────────────────────────────────────────────────────────────

const demoLink = (id) => {
  const demo = rows.get(id).demo;
  if (!demo) return existsSync(join(experimentsDir, id, "README.md")) ? `../experiments/patterns/${id}/README.md` : null;
  return /^https?:/.test(demo) ? demo : `../${demo}`;
};

function provingRun(id) {
  const rec = records.get(id);
  if (rec === null) return "**Proving run.** None recorded. No claim is made about how this template behaves when run.";
  const lines = [];
  const header = `One recorded run, ${code(rec.runId)}${rec.harness ? ` on ${rec.harness}` : ""}.`;
  if (rec.runId === undefined) return `**Proving run.** The record in ${code(`experiments/patterns/${id}/run/`)} is not readable as a run: ${rec.problems.join("; ")}.`;
  lines.push(`**Proving run.** ${header}`, "");
  const findings = [];
  if (rec.problems.length === 0) lines.push("- **Check:** passed.");
  else if (rec.problems.length === 1) lines.push(`- **Check: failed**, on one finding: ${rec.problems[0]}. The record is kept as it ran (decision 0009).`);
  else {
    lines.push(`- **Check: failed**, on ${numberWord(rec.problems.length)} findings; the first: ${rec.problems[0]}. The record is kept as it ran (decision 0009), and the findings are the check's own words, below.`);
    findings.push("", `<details><summary>The check's ${numberWord(rec.problems.length)} findings</summary>`, "", ...rec.problems.map((p) => `- ${p}`), "", "</details>");
  }
  lines.push(`- **Rounds:** ${rec.lastRound === null ? "no loop round was recorded" : `last round ${rec.lastRound}`}; ${backEdgeWords(rec.back)}.`);
  lines.push(`- **Ended:** ${endingWords(rec.ending)}.`);
  lines.push(`- **Cost:** ${money(rec.cost)}${invocationWords(rec.invocations)}${rec.costDiffers === null ? "" : `; the run's own result.json says ${money(rec.costDiffers)}`}.`);
  const earlier = rec.earlier ?? [];
  for (const old of earlier) {
    lines.push(
      `- **An earlier run** of this template, ${code(old.runId)}, is kept in ${code(`experiments/patterns/${id}/${old.name}/`)}; its check ${old.problems.length === 0 ? "passed" : `failed (${old.problems.map((p) => p.replace(/\.$/, "")).join("; ")})`}. The run above is the later one.`,
    );
  }
  const link = demoLink(id);
  if (link) lines.push(`- [Write-up and evidence](${link}): what happened in that one run, in the author's words.`);
  return [...lines, ...findings].join("\n");
}

function useIt(id) {
  const doc = docs.get(id).doc;
  const slots = slotKeys(id);
  const sets = slots.map((key) => `--set ${key}="..."`);
  const fragment = kindOf(id) === "fragment";
  const body = [];
  if (fragment) {
    body.push(`grooph template insert ${id} --into my-graph.grooph.json \\`);
    if (sets.length > 0) body.push(`  ${sets.join(" ")} \\`);
    body.push("  --write");
  } else {
    body.push(`grooph template use ${id} --name "My graph" \\`);
    if (sets.length > 0) body.push(`  ${sets.join(" ")} \\`);
    body.push("  --out my-graph.grooph.json");
  }
  const ask = fragment ? `add the ${id} fragment to my graph` : `propose a graph for <what you are building>, starting from the ${id} template`;
  void doc;
  return [
    "**Use it.**",
    "",
    "```bash",
    ...body,
    "```",
    "",
    "In a Claude Code session with the `grooph-design` skill:",
    "",
    "```text",
    `/grooph-design ${ask}`,
    "```",
    "",
    `[Open it in the app](${APP}/#/templates/built-in/${id}) · [the template document](../patterns/${docs.get(id).file})`,
  ].join("\n");
}

function section(id) {
  const row = rows.get(id);
  const template = docs.get(id).doc.template;
  const out = [`<a id="${id}"></a>`, `### ${row.title}`, ""];
  out.push(`<img src="field-guide/${id}.svg" alt="The shape of ${esc(row.title)}: ${esc(shapeOf(id))}">`, "");
  out.push(`**Use when.** ${row.whenToUse}`, "");
  if (template.notFor) out.push(`**Not for.** ${template.notFor}`, "");
  out.push(`**Cost, speed, rigor.** ${capital(profileWords(row.profile))}.`, "");
  out.push(`**Shape.** ${shapeOf(id)}`, "");
  if ((row.credits ?? []).length > 0) {
    if (row.credits.length === 1) out.push(`**Prior art.** [${row.credits[0].name}](${row.credits[0].url}): ${row.credits[0].note}.`, "");
    else out.push("**Prior art.**", "", ...row.credits.map((c) => `- [${c.name}](${c.url}): ${c.note}.`), "");
  }
  out.push(provingRun(id), "", useIt(id), "");
  return out.join("\n");
}

const graphs = ids.filter((id) => kindOf(id) === "graph");
const fragments = ids.filter((id) => kindOf(id) === "fragment");
const recorded = ids.filter((id) => records.get(id) !== null);
const green = recorded.filter((id) => passed(records.get(id)));
const red = recorded.filter((id) => !passed(records.get(id)));
const total = ids.reduce((sum, id) => sum + (records.get(id)?.cost ?? 0), 0);

const index_ = (group) => group.map((id) => `- [${title(id)}](#${id}): ${rows.get(id).summary}`).join("\n");

const guide = `# A field guide to the loop shapes

grooph ships ${numberWord(ids.length)} templates. Each is a small graph of agents, checks and human gates, with the loops that bring work back, and each is drawn here as a glyph beside when to reach for it, what it costs, what is on record about it, and the line that starts it. Pick by shape, then ask for it by name. [The poster](field-guide/poster.svg) shows all ${numberWord(ids.length)} on one page.

## How to read it

### What a loop shape is

A graph document ([graph-ir](graph-ir.md)) says who does what, and in what order. Its **shape** is the part you can see without reading a word: how many agents there are, which of them build and which judge, where a check or a human gate stands, and which edges send work back to an earlier step. A **loop** is that return: its member nodes, the edge that sends work back, the bar the work is judged against, and the stops that end it (a bar passed, a round cap, a budget, a human). A shape with no loop runs once, front to back. A template is a graph document with slots to fill; the shape is what stays the same when you fill them.

### What the marks in a glyph mean

The glyph is the wordless picture of a graph, drawn by core's \`glyph()\` (\`grooph glyph <file>\` draws any document); the app, the CLI and the write-ups all draw it the same way.

| Mark | Means |
|---|---|
| Square | an agent that writes: a builder, a planner, a synthesizer |
| Diamond | an agent that judges: a critic, a judge, a red team |
| Rounded square | any other agent: a lead, a tester, a researcher, a role of its own |
| Hexagon | a check: a command whose result decides |
| Octagon, heavier outline | a human gate: the run halts and asks a person |
| Circle | a merge: parallel work comes together |
| Filled dot | where the graph stops (amber when it stops on a halt) |
| Red bar under a node | a step that cannot be undone (merge, publish, spend, delete) |
| Solid line | the next step runs when the one before it is done or passes |
| Dashed amber line | the step before it failed |
| Dotted line | a judge's verdict decides whether the edge is taken |
| Doubled line | a person's approval is needed to take it |
| Dashed hull | a loop, drawn around its members; each loop has its own color |
| Arc below the nodes | a back edge: work returning to an earlier step |

### What the words under a shape mean

**Cost, speed and rigor** are coarse words the template's author chose (low, medium or high; fast, medium or slow; light, standard or high), not measurements. The measured cost is in the proving run.

**Shape** is one line from \`grooph shape\`: counts of agents, checks, gates and loops; "up to N rounds" is the worst case from the loops' round caps (nested loops multiplied); a budget is a loop's own brake. Counts and brakes, never dollars.

### What a proving run is, and is not

Every template has one recorded headless run on a small task, kept under \`experiments/patterns/<id>/\`: the harness's output as it ran, a one-screen write-up, and a row in the spend ledger. Cost below is the ledger's. **Check** is the proving check (\`scripts/prove-pattern.sh --check\`) run again on the kept evidence: it asks whether the package drove the session as its graph says (the named agents ran as their own subagents, the stops and gates fired as written, the record is whole). A run that fails the check is kept red and says why (decision 0009).

A passing check is not a claim that the template improves the work. As of study one the evidence shows that grooph bounds and records autonomous work and holds a design as a runtime contract; it does not show better quality than the same instructions given as a prompt, on small tasks a strong builder finishes in one pass (decisions 0012 and 0013). A write-up says what happened in one run; it is not a benchmark, and whether the task's bet paid is in the write-up, not in the check.

Of the ${numberWord(recorded.length)} recorded runs ${numberWord(green.length)} passed their check${red.length > 0 ? ` and ${numberWord(red.length)} did not (${list(red.map((id) => code(id)))})` : ""}; the ${numberWord(recorded.length)} kept runs cost ${money(total)} (the whole proving ledger, which also counts the runs since replaced and a few probes, stands at ${money(ledger.spent_usd)}).

**Prior art** names whose published work a shape or name comes from, and what was taken. It is not an endorsement by that author, and no template claims to beat a named product (decision 0010).

## The shapes

${capital(numberWord(graphs.length))} whole graphs, then ${numberWord(fragments.length)} fragments: nodes that you insert into a graph you already have.

### Whole graphs

${index_(graphs)}

### Fragments

${index_(fragments)}

## Whole graphs

${graphs.map(section).join("\n")}
## Fragments

${fragments.map(section).join("\n")}
_Generated by \`scripts/field-guide.mjs\` from \`patterns/\` and \`experiments/patterns/\`, like \`field-guide/\` beside it (the glyphs and the poster). Edit a template or a record, then run \`node scripts/field-guide.mjs\`; CI fails when any of them is stale._
`;

// ─── the poster ────────────────────────────────────────────────────────────

const ink = inkFor("light");
const FS = { name: 19, body: 14, small: 13 };

const W = 1200;
const M = 40;
const GUT = 16;
const COLS = 3;
const CW = (W - 2 * M - (COLS - 1) * GUT) / COLS;
const PAD = 14;
const GLYPH_H = 92;
const CH = 198;
const RG = 12;
const HEADER_H = 140;

/** Text must fit; a line that does not is a defect in the layout, found now and not in a printout. */
function fit(content, width, size, weight = "regular") {
  if (textWidth(content, size, weight) > width) throw new Error(`field-guide: "${content}" is ${Math.round(textWidth(content, size, weight))} wide at ${size}px, the room is ${Math.round(width)}`);
  return content;
}

/** The glyph's own SVG, scaled to sit in a box and centered in it; its CSS variables replaced by their fallbacks so the poster has none. */
function place(svg, x, y, w, h, maxScale = Infinity) {
  const m = /viewBox="(-?[\d.]+) (-?[\d.]+) ([\d.]+) ([\d.]+)"/.exec(svg);
  const [vx, vy, vw, vh] = m.slice(1).map(Number);
  const s = Math.min(w / vw, h / vh, maxScale);
  const dw = vw * s;
  const dh = vh * s;
  const inner = svg
    .slice(svg.indexOf(">") + 1, svg.lastIndexOf("</svg>"))
    .replace(/<title>[\s\S]*?<\/title>\n?/, "")
    .replace(/var\(--[a-z0-9-]+,\s*(#[0-9a-fA-F]{3,8})\)/g, "$1")
    .replace(/\n/g, "");
  return `<svg x="${fmt(x + (w - dw) / 2)}" y="${fmt(y + (h - dh) / 2)}" width="${fmt(dw)}" height="${fmt(dh)}" viewBox="${vx} ${vy} ${vw} ${vh}" fill="none" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}

const WEAK_ENDINGS = new Set(
  "a an the and or of to for in on at by with that than is are as but so if when while where which who from into not only named genuinely both each every any should must can will then after before its their this be no one".split(" "),
);

/**
 * Two lines of "use when". The whole text when it fits. Otherwise the longest
 * cut that fits, made between words and never inside a parenthesis or after a
 * word like "the"; a cut that ends a sentence (no ellipsis) or a clause is
 * taken over a longer one when it is at least three quarters as long.
 */
function twoLines(content, width, size) {
  const clean = content.replace(/\s+/g, " ").trim();
  const fits = (candidate) => {
    const lines = wrap(candidate, width, size, 2);
    return lines.join(" ") === candidate ? lines : null;
  };
  const whole = fits(clean);
  if (whole) return whole;
  let best = null;
  let natural = null;
  let depth = 0;
  for (const m of clean.matchAll(/\S+/g)) {
    for (const ch of m[0]) depth += ch === "(" ? 1 : ch === ")" ? -1 : 0;
    if (depth !== 0) continue;
    const word = m[0];
    const raw = clean.slice(0, m.index + word.length);
    const sentence = /\.$/.test(word);
    const clause = /[:;,]$/.test(word) || /\)$/.test(word);
    if (!sentence && WEAK_ENDINGS.has(word.replace(/[,;:)]+$/, "").toLowerCase())) continue;
    const candidate = sentence ? raw : `${raw.replace(/[:;,]$/, "")}…`;
    const lines = fits(candidate);
    if (!lines) continue;
    best = { candidate, lines };
    if (sentence || clause) natural = best;
  }
  if (!best) return wrap(clean, width, size, 2);
  return (natural && natural.candidate.length >= 0.6 * best.candidate.length ? natural : best).lines;
}

/** The mark of a record: a green disc with a tick when its check passed, an amber one with a cross when it did not, a ring when there is no run. */
function markIcon(cx, cy, state) {
  if (state === "none") return `<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="6" stroke-width="1.5" style="fill:none;stroke:${ink("ink-3")}"/>`;
  const color = state === "passed" ? ink("ok") : ink("warning");
  const strokes =
    state === "passed"
      ? `M${fmt(cx - 3.3)},${fmt(cy + 0.2)} L${fmt(cx - 0.9)},${fmt(cy + 2.8)} L${fmt(cx + 3.5)},${fmt(cy - 2.7)}`
      : `M${fmt(cx - 2.9)},${fmt(cy - 2.9)} L${fmt(cx + 2.9)},${fmt(cy + 2.9)} M${fmt(cx + 2.9)},${fmt(cy - 2.9)} L${fmt(cx - 2.9)},${fmt(cy + 2.9)}`;
  return `<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="7.5" style="fill:${color}"/><path d="${strokes}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="fill:none;stroke:${ink("surface")}"/>`;
}

function cell(id, x, y) {
  const row = rows.get(id);
  const rec = records.get(id);
  const state = rec === null ? "none" : passed(rec) ? "passed" : "failed";
  const inner = CW - 2 * PAD;
  // A fragment's cell has a dashed outline; one whose record failed its check, an amber one.
  const outline = state === "failed" ? { stroke: ink("warning"), width: 2 } : { stroke: ink("line-strong"), width: 1 };
  const parts = [rect(x, y, CW, CH, { fill: ink("bg"), rx: 10, ...outline, ...(kindOf(id) === "fragment" ? { dash: "6 4" } : {}) })];
  // Name: as large as the room allows, no smaller than 16.
  let size = FS.name;
  while (size > 16 && textWidth(row.title, size, "bold") > inner) size -= 1;
  parts.push(text(x + PAD, y + PAD + 17, fit(row.title, inner, size, "bold"), { size, fill: ink("ink"), weight: "bold" }));
  // The glyph, in a box the same size in every cell.
  const gy = y + PAD + 24;
  parts.push(place(glyph(docs.get(id).doc), x + PAD, gy, inner, GLYPH_H, 1.15));
  // Use when, cut to two lines.
  const lines = twoLines(row.whenToUse, inner, FS.body);
  const ty = gy + GLYPH_H + 13;
  lines.forEach((line, i) => parts.push(text(x + PAD, ty + i * 17, fit(line, inner, FS.body), { size: FS.body, fill: ink("ink-2") })));
  // Cost, speed, rigor; then the record's mark.
  const by = y + CH - PAD - 2;
  const profile = `cost ${row.profile.cost} · speed ${row.profile.speed} · rigor ${row.profile.rigor}`;
  parts.push(text(x + PAD, by, fit(profile, inner - 24, FS.small), { size: FS.small, fill: ink("ink-3") }));
  parts.push(markIcon(x + CW - PAD - 7.5, by - 4.5, state));
  return `<g><title>${esc(`${row.title}: ${row.whenToUse}`)}</title>${parts.join("")}</g>`;
}

// The legend is drawn by the same function that draws every glyph, from the smallest graphs that show each mark.
const node = (kind, extra = {}) => ({ id: "n", kind, ...extra });
const miniDoc = (nodes, edges = [], loops = []) => ({ id: "legend", name: "legend", nodes, edges, loops });
const dots = (edge) => miniDoc([{ id: "a", kind: "stop" }, { id: "b", kind: "stop" }], [{ id: "e", from: "a", to: "b", ...edge }]);
const loopDoc = miniDoc(
  [
    { id: "a", kind: "agent", role: "builder" },
    { id: "b", kind: "check" },
  ],
  [
    { id: "e1", from: "a", to: "b" },
    { id: "e2", from: "b", to: "a", when: "fail" },
  ],
  [{ id: "l", members: ["a", "b"], back: ["e2"] }],
);

function legend(x, y) {
  const parts = [rect(x, y, CW, CH, { fill: ink("surface"), stroke: ink("accent"), rx: 10, width: 1.5 })];
  parts.push(text(x + PAD, y + PAD + 16, "Reading a shape", { size: 18, fill: ink("ink"), weight: "bold" }));
  const nodes = [
    ["writer", node("agent", { role: "builder" })],
    ["critic or judge", node("agent", { role: "critic" })],
    ["other agent", node("agent", { role: "tester" })],
    ["check", node("check")],
    ["human gate", node("human-gate")],
    ["merge", node("merge")],
    ["stop", node("stop")],
    ["irreversible step", node("agent", { role: "builder", irreversible: ["merge"] })],
  ];
  const rowH = 18.5;
  const top = y + PAD + 28;
  const colB = x + PAD + 150;
  const labelW = CW - PAD * 2 - 150 - 62;
  nodes.forEach(([label, doc], i) => {
    const ry = top + i * rowH;
    parts.push(place(glyph(miniDoc([doc])), x + PAD, ry, 26, rowH - 1));
    parts.push(text(x + PAD + 32, ry + 13, fit(label, 150 - 36, FS.small), { size: FS.small, fill: ink("ink-2") }));
  });
  const lines = [
    ["passes", dots({})],
    ["fails", dots({ when: "fail" })],
    ["a verdict", dots({ when: { verdict: "v" } })],
    ["needs approval", dots({ approval: true })],
  ];
  lines.forEach(([label, doc], i) => {
    const ry = top + i * rowH;
    parts.push(place(glyph(doc), colB, ry, 56, rowH - 1));
    parts.push(text(colB + 62, ry + 13, fit(label, labelW, FS.small), { size: FS.small, fill: ink("ink-2") }));
  });
  const ly = top + 4 * rowH + 2;
  parts.push(place(glyph(loopDoc), colB - 2, ly, 60, 4 * rowH - 4));
  const caption = wrap("a loop: dashed hull, its return arc below", labelW, FS.small, 3);
  caption.forEach((line, i) => parts.push(text(colB + 62, ly + 14 + i * 15, fit(line, labelW, FS.small), { size: FS.small, fill: ink("ink-2") })));
  return `<g><title>How to read a glyph</title>${parts.join("")}</g>`;
}

function poster() {
  const body = [];
  const rowsCount = Math.ceil((ids.length + 1) / COLS);
  const gridY = M + HEADER_H;
  const gridH = rowsCount * CH + (rowsCount - 1) * RG;
  const footY = gridY + gridH + 28;
  const keyY = footY + 14;
  const noteY = keyY + 30;
  const H = noteY + 28 + M;

  // Header: the title and what it is on the left, where to find it on the right.
  const heading = `${capital(numberWord(ids.length))} loop shapes`;
  body.push(text(M, M + 42, fit(heading, 620, 52, "bold"), { size: 52, fill: ink("ink"), weight: "bold" }));
  const sub = wrap("A field guide to grooph's templates for multi-agent work: what each shape is, and when to reach for it.", 620, 19, 2);
  sub.forEach((line, i) => body.push(text(M, M + 76 + i * 25, fit(line, 620, 19), { size: 19, fill: ink("ink-2") })));
  body.push(rect(M, M + 120, 96, 4, { fill: ink("accent"), rx: 2 }));
  const bx = W - M - 450;
  body.push(rect(bx, M, 450, 112, { fill: ink("accent-soft"), stroke: ink("accent"), rx: 12, width: 1.5 }));
  body.push(text(bx + 18, M + 30, "Open any shape in the app:", { size: 15, fill: ink("ink-2") }));
  body.push(text(bx + 18, M + 62, fit(APP_HOST, 414, 20, "bold"), { size: 20, fill: ink("accent"), weight: "bold" }));
  body.push(text(bx + 18, M + 90, "or on the command line:  ", { size: 15, fill: ink("ink-2") }));
  body.push(text(bx + 18 + textWidth("or on the command line:  ", 15) + 2, M + 90, "grooph template list", { size: 15, fill: ink("ink"), weight: "mono" }));

  // The grid: whole graphs, then fragments, then the legend in the cell left over.
  ids.forEach((id, i) => body.push(cell(id, M + (i % COLS) * (CW + GUT), gridY + Math.floor(i / COLS) * (CH + RG))));
  const li = ids.length;
  body.push(legend(M + (li % COLS) * (CW + GUT), gridY + Math.floor(li / COLS) * (CH + RG)));

  // The key to the marks on the cells, then the one caution the page owes its reader.
  let kx = M;
  const key = (draw_, label) => {
    body.push(draw_(kx));
    const width = textWidth(label, 14) + 12;
    body.push(text(kx + 20, keyY + 5, fit(label, width, 14), { size: 14, fill: ink("ink-2") }));
    kx += 20 + width + 28;
  };
  key((x) => markIcon(x + 7.5, keyY, "passed"), "the recorded run's check passed");
  key((x) => markIcon(x + 7.5, keyY, "failed"), "its check failed (amber outline)");
  key((x) => rect(x, keyY - 8, 16, 16, { fill: ink("bg"), stroke: ink("line-strong"), rx: 4, width: 1.2, dash: "3 2" }), "dashed cell: a fragment, to insert into a graph");
  if (kx - 28 > W - M) throw new Error(`field-guide: the key is ${Math.round(kx - 28 - M)} wide, the room is ${W - 2 * M}`);
  const caution = "One recorded run on a small task shows how a shape behaved once. It does not show that a shape beats the same instructions given as a prompt.";
  body.push(text(M, noteY, fit(caution, W - 2 * M, 14), { size: 14, fill: ink("ink-2") }));
  body.push(text(M, noteY + 22, fit("Made by scripts/field-guide.mjs from the template library and its proving records. The full records are in docs/field-guide.md.", W - 2 * M, 13), { size: 13, fill: ink("ink-3") }));

  return frame(W, H, `${heading}: a field guide to grooph's templates`, "light", ink, body.join(""), "field-guide-poster");
}

// ─── write or check ────────────────────────────────────────────────────────

const outputs = [{ path: guidePath, text: guide }, ...glyphFiles.map(({ path, text: body }) => ({ path, text: body })), { path: join(assetsDir, "poster.svg"), text: poster() }];
const strays = existsSync(assetsDir) ? readdirSync(assetsDir).map((name) => join(assetsDir, name)).filter((path) => !outputs.some((o) => o.path === path)) : [];
const rel = (path) => path.slice(root.length + 1);

if (process.argv.includes("--check")) {
  const stale = outputs.filter(({ path, text: body }) => {
    try {
      return readFileSync(path, "utf8") !== body;
    } catch {
      return true;
    }
  });
  if (stale.length > 0 || strays.length > 0) {
    console.error(
      `stale: ${[...stale.map(({ path }) => rel(path)), ...strays.map((path) => `${rel(path)} (no template)`)].join(", ")}; run \`node scripts/field-guide.mjs\` and commit the result`,
    );
    process.exit(1);
  }
  console.log(`docs/field-guide.md and docs/field-guide/ are current (${ids.length} templates, ${green.length} checks passed, ${red.length} failed)`);
} else {
  mkdirSync(assetsDir, { recursive: true });
  for (const { path, text: body } of outputs) writeFileSync(path, body, "utf8");
  for (const path of strays) rmSync(path);
  console.log(`wrote docs/field-guide.md, ${glyphFiles.length} glyphs and the poster (${ids.length} templates; ${green.length} checks passed, ${red.length} failed)`);
}

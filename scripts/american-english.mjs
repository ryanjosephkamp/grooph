#!/usr/bin/env node
/**
 * Public-facing text is written in American English (decision 0022). This finds British spellings in it.
 *
 *   node scripts/american-english.mjs            list what it finds, with the American form
 *   node scripts/american-english.mjs --check    the same, and exit 1 when it finds any (CI runs this)
 *   node scripts/american-english.mjs --all      look at the internal record too, to see what is there (never fails)
 *
 * What is public-facing: the README, the documents the site renders and the other reference documents, the app, the
 * CLI, the core (its messages and what the compiler writes), the templates, the community folder, the plugin, the
 * scripts that generate public pages, the fixtures and the issue templates. Whole files are read, comments and names
 * included, so a British word cannot reach a message by way of a variable.
 *
 * What is not: the internal record. Handoffs and handbacks, decisions, the plan, the progress page and its history, the review
 * of October 2026, and everything under experiments/ (evidence is never edited by hand, decision 0009). The spec is
 * frozen and changes only by amendment. New internal writing is American too, but nothing checks the old.
 *
 * It knows words, not grammar: a list of British spellings by family, each with its American form. A word that is
 * right where it stands (another system's own name for something) goes in ALLOWED with the reason.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Paths git tracks that are public-facing. A path is checked when it starts with one of these… */
const PUBLIC = [
  "README.md",
  "AGENTS.md",
  "CLAUDE.md",
  "LICENSE",
  "docs/",
  "apps/web/src/",
  "apps/web/public/",
  "apps/web/index.html",
  "apps/web/e2e/",
  "apps/web/test/",
  "packages/",
  "patterns/",
  "community/",
  "plugins/",
  "scripts/",
  "fixtures/",
  ".github/",
  ".claude/skills/",
  "package.json",
];
/** …and does not start with one of these: the internal record, and files that are not prose. */
const INTERNAL = [
  "docs/decisions/",
  "docs/PROGRESS.md",
  "docs/HISTORY.md",
  "docs/PLAN.md",
  "docs/review-2026-10.md",
  "docs/review-2026-10/",
  "scripts/american-english.mjs",
];
const TEXT = /\.(md|mdx|txt|json|ya?ml|ts|tsx|js|mjs|cjs|css|html|svg|sh|toml)$|^LICENSE$/;

/**
 * Right where it stands. `word` is matched whole, without regard to case; `under` is a path prefix; `line`, when
 * given, must appear in the line.
 */
const ALLOWED = [
  { word: "cancelled", under: ".github/", why: "GitHub's own name for a run's conclusion" },
  { word: "cancelled", under: "scripts/", line: "conclusion", why: "GitHub's own name for a run's conclusion" },
  { word: "cancelled", under: "scripts/lib/compare-score", why: "node:test's own word in the summary it prints" },
  { word: "prioritise", under: "docs/field-guide.md", line: "**Ended:**", why: "the node's id in the run recorded on 2026-09-22; a record is not respelled, and the template's re-proof will replace it" },
  { word: "spelt", under: "packages/cli/hooks/grooph-events-push.mjs", why: "a comment in a script other repositories hold copies of; it changes with the script's next real change, not for a word" },
  { word: "behaviour", under: "scripts/lib/compare-run.mjs", line: "score it from 1 to 5", why: "the blind judge's prompt in study one: an instrument is not reworded between studies" },
];

/** British stem, American stem. Each takes the endings in ISE below: organise, organised, organisation… */
const ISE = ["agonis", "apologis", "authoris", "capitalis", "categoris", "centralis", "characteris", "criticis", "customis", "digitis", "emphasis", "equalis", "familiaris", "finalis", "formalis", "generalis", "harmonis", "hypothesis", "initialis", "itemis", "legalis", "localis", "materialis", "maximis", "memoris", "minimis", "modernis", "monetis", "neutralis", "normalis", "optimis", "organis", "parametris", "penalis", "personalis", "popularis", "prioritis", "randomis", "rationalis", "realis", "recognis", "sanitis", "serialis", "specialis", "stabilis", "standardis", "summaris", "symbolis", "synchronis", "theoris", "tokenis", "utilis", "visualis"];
const OUR = ["armo", "behavio", "colo", "endeavo", "favo", "flavo", "harbo", "hono", "humo", "labo", "neighbo", "rumo", "vapo"];
/** Whole words, British to American. A trailing `*` lets ordinary endings follow (s, ed, ing, er…). */
const WORDS = {
  "analyse": "analyze", "analysed": "analyzed", "analysing": "analyzing", "analyser": "analyzer",
  "catalyse": "catalyze", "paralyse": "paralyze", "paralysed": "paralyzed",
  "centre": "center", "centres": "centers", "centred": "centered", "centring": "centering",
  "metre": "meter", "metres": "meters", "litre": "liter", "litres": "liters", "fibre": "fiber", "fibres": "fibers", "theatre": "theater", "calibre": "caliber", "sombre": "somber", "manoeuvre": "maneuver",
  "licence": "license", "licences": "licenses", "defence": "defense", "offence": "offense", "pretence": "pretense",
  "grey": "gray", "greys": "grays", "greyed": "grayed", "greyish": "grayish", "greyscale": "grayscale",
  "artefact": "artifact", "artefacts": "artifacts", "sceptic": "skeptic", "sceptics": "skeptics", "sceptical": "skeptical", "scepticism": "skepticism",
  "catalogue": "catalog", "catalogues": "catalogs", "catalogued": "cataloged", "programme": "program", "programmes": "programs",
  "cheque": "check", "tyre": "tire", "plough": "plow", "kerb": "curb", "mould": "mold", "storey": "story", "cosy": "cozy", "aluminium": "aluminum",
  "travelled": "traveled", "travelling": "traveling", "traveller": "traveler", "travellers": "travelers",
  "labelled": "labeled", "labelling": "labeling", "modelled": "modeled", "modelling": "modeling",
  "cancelled": "canceled", "cancelling": "canceling", "signalled": "signaled", "signalling": "signaling",
  "levelled": "leveled", "levelling": "leveling", "fuelled": "fueled", "fuelling": "fueling", "channelled": "channeled", "channelling": "channeling",
  "totalled": "totaled", "totalling": "totaling", "dialled": "dialed", "dialling": "dialing", "tunnelled": "tunneled", "funnelled": "funneled", "marshalled": "marshaled",
  "equalled": "equaled", "initialled": "initialed", "pencilled": "penciled", "quarrelled": "quarreled", "counsellor": "counselor", "jewellery": "jewelry",
  "focussed": "focused", "focussing": "focusing", "benefitted": "benefited", "benefitting": "benefiting",
  "fulfil": "fulfill", "fulfils": "fulfills", "fulfilment": "fulfillment", "enrol": "enroll", "enrols": "enrolls", "enrolment": "enrollment",
  "skilful": "skillful", "wilful": "willful", "instalment": "installment", "instalments": "installments", "distil": "distill", "instil": "instill",
  "whilst": "while", "amongst": "among", "learnt": "learned", "spelt": "spelled", "dreamt": "dreamed", "leant": "leaned", "spoilt": "spoiled",
  "judgement": "judgment", "judgements": "judgments", "acknowledgement": "acknowledgment", "acknowledgements": "acknowledgments",
  "ageing": "aging", "sizeable": "sizable", "likeable": "likable", "moveable": "movable", "unshakeable": "unshakable",
  "practise": "practice", "practised": "practiced", "practises": "practices", "practising": "practicing",
  "maths": "math", "speciality": "specialty", "specialities": "specialties", "orientated": "oriented", "anticlockwise": "counterclockwise",
  "enquire": "inquire", "enquiry": "inquiry", "enquiries": "inquiries", "per cent": "percent", "draught": "draft", "tonne": "ton", "tonnes": "tons",
};

const iseEnding = "(e|es|ed|er|ers|ing|ation|ations|able)";
const families = [
  // organise → organize: the s becomes z, the ending stays.
  { re: new RegExp(`\\b(${ISE.join("|")})${iseEnding}\\b`, "gi"), fix: (m) => m.replace(/s(e|es|ed|er|ers|ing|ation|ations|able)$/i, (t, end) => (t[0] === "S" ? "Z" : "z") + end) },
  // colour → color, favourite → favorite, neighbourhood → neighborhood: the u goes.
  { re: new RegExp(`\\b(${OUR.join("|")})ur(?=[a-z]*\\b)[a-z]*`, "gi"), fix: (m) => m.replace(/([Oo])[Uu]([Rr])/, "$1$2") },
  { re: new RegExp(`\\b(${Object.keys(WORDS).join("|")})\\b`, "gi"), fix: (m) => cased(m, WORDS[m.toLowerCase()]) },
];
/** The American word in the British word's case: Colour → Color, COLOUR → COLOR. */
function cased(from, to) {
  if (from === from.toUpperCase() && from.length > 1) return to.toUpperCase();
  if (from[0] === from[0].toUpperCase()) return to[0].toUpperCase() + to.slice(1);
  return to;
}
// Not verbs in -ise though they begin like one: the nouns "emphasis" and "hypothesis" take no ending here.
const NOT = /^(emphasis|hypothesis)$/i;

const all = process.argv.includes("--all");
const files = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
  .split("\n")
  .filter((f) => f && TEXT.test(f) && !f.includes("/dist/") && !f.endsWith("pnpm-lock.yaml"))
  .filter((f) => all || (PUBLIC.some((p) => f === p || f.startsWith(p)) && !INTERNAL.some((p) => f === p || f.startsWith(p))));

const allowed = (file, word, line) => ALLOWED.some((a) => a.word === word.toLowerCase() && file.startsWith(a.under) && (!a.line || line.includes(a.line)));
const found = [];
for (const file of files) {
  let text;
  try {
    text = readFileSync(resolve(root, file), "utf8");
  } catch {
    continue;
  }
  const lines = text.split("\n");
  lines.forEach((line, i) => {
    if (line.length > 4000) return; // one line of packed data, not prose
    for (const { re, fix } of families) {
      re.lastIndex = 0;
      for (let m = re.exec(line); m; m = re.exec(line)) {
        const word = m[0];
        if (NOT.test(word) || allowed(file, word, line)) continue;
        // Inside a link's address the word is someone else's.
        const before = line.slice(0, m.index);
        if (/https?:\/\/[^\s)"']*$/.test(before)) continue;
        found.push({ file, line: i + 1, word, to: fix(word) });
      }
    }
  });
}

const fixing = process.argv.includes("--fix");
if (fixing) {
  // Rewrites the words in place. Read the diff afterwards: an id or a key that other files name must change with them.
  const byFile = new Map();
  for (const f of found) byFile.set(f.file, [...(byFile.get(f.file) ?? []), f]);
  for (const [file, list] of byFile) {
    const lines = readFileSync(resolve(root, file), "utf8").split("\n");
    for (const { line, word, to } of list) lines[line - 1] = lines[line - 1].split(word).join(to);
    (await import("node:fs")).writeFileSync(resolve(root, file), lines.join("\n"));
  }
}

const byWord = new Map();
for (const f of found) byWord.set(f.word.toLowerCase(), (byWord.get(f.word.toLowerCase()) ?? 0) + 1);
if (process.argv.includes("--summary")) {
  const byArea = new Map();
  for (const f of found) {
    const area = f.file.split("/").slice(0, 2).join("/");
    byArea.set(area, (byArea.get(area) ?? 0) + 1);
  }
  for (const [area, n] of [...byArea].sort((a, b) => b[1] - a[1])) console.log(`${String(n).padStart(5)}  ${area}`);
  console.log([...byWord].sort((a, b) => b[1] - a[1]).map(([w, n]) => `${w} ${n}`).join(", "));
} else {
  for (const f of found) console.log(`${f.file}:${f.line}: ${f.word} → ${f.to}`);
}
console.log(found.length === 0 ? `american-english: nothing British in ${files.length} public-facing files` : `american-english: ${found.length} British spelling${found.length === 1 ? "" : "s"} in ${new Set(found.map((f) => f.file)).size} of ${files.length} files${fixing ? ", rewritten" : ""}`);
if (process.argv.includes("--check") && found.length > 0) {
  console.error("american-english: public-facing text is American English (decision 0022). Use the form after the arrow, or add the word to ALLOWED in scripts/american-english.mjs with the reason it is right where it stands.");
  process.exit(1);
}

/**
 * Second reader, slice 0108. `grooph hooks install --user` / `remove --user` against a model written apart from
 * the code (model.mjs): many settings texts in many legal layouts, and for each, three runs of the real command
 * line in scratch folders:
 *
 *   base    install, install again, remove
 *   switch  install, install with --tools the other way, remove
 *   moved   install, install with GROOPH_HOME naming another folder, remove
 *
 * Checked with the model's own tokenizer (never grooph's):
 *   (1) what is written parses
 *   (2) every top-level member other than "hooks" is the same text, in the same order; the text before and after
 *       hooks' value is the same; where hooks was missing, the file changed in one place only
 *   (3) inside hooks every entry that was there is there, in order, the same text (an entry grooph's command was
 *       joined into: the same tokens without grooph's command)
 *   (4) grooph's entries are exactly the expected ones, once each, last in their lists
 *   (5) a second install leaves the file as the first left it
 *   (6) remove gives back the bytes there were (with entries of an earlier install in the file: the same tokens
 *       without them)
 * A refusal (exit not 0) is counted by its words, and the file must then be unchanged.
 *
 *   node 11-fuzz-settings.mjs [--seed 1] [--count 300] [--small] [--jobs 8]
 *
 * Every grooph run goes through the first reader's lib.mjs (scratch folders only).
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { gSpawn, person, S } from "../reader/lib.mjs";
import { emit, expectedEntries, rng, same, settingsValue, spans, STYLES, tokenTexts, withoutOurs } from "./model.mjs";

const arg = (name, fallback) => {
  const at = process.argv.indexOf(`--${name}`);
  return at < 0 ? fallback : process.argv[at + 1];
};
const SEED = Number(arg("seed", "1"));
const COUNT = Number(arg("count", "300"));
const JOBS = Number(arg("jobs", "8"));
const SMALL = process.argv.includes("--small");

const run = (env, args) =>
  new Promise((done) => {
    const child = gSpawn(env, args);
    let out = "";
    let err = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), 60_000);
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("close", (status, signal) => {
      clearTimeout(timer);
      done({ status, signal, out, err });
    });
  });

// ─── The tally ────────────────────────────────────────────────────────────
const kinds = new Map(); // kind -> { n, smallest: { text, where } }
const fail = (kind, text, where) => {
  const k = kinds.get(kind) ?? kinds.set(kind, { n: 0, smallest: undefined }).get(kind);
  k.n += 1;
  if (k.smallest === undefined || text.length < k.smallest.text.length) k.smallest = { text, where };
};
const counts = { texts: 0, runs: 0, installs: 0, installChecked: 0, second: 0, secondSame: 0, removes: 0, removeToTheLetter: 0, removeExpectedTokens: 0, refusals: 0, sequences: 0, cleanSequences: 0 };

/** An abstract value from a text, for the small cases written by hand (nothing in them is grooph's). */
function absFromText(text) {
  const go = (n) => (n.kind === "atom" ? { k: "atom", raw: text.slice(n.s, n.e) } : n.kind === "obj" ? { k: "obj", members: n.members.map((m) => ({ key: m.keyRaw, node: go(m.node) })) } : { k: "arr", elems: n.elems.map(go) });
  return go(spans(text));
}
const hasOurs = (n) => (n.k === "atom" ? false : n.ours !== undefined || (n.k === "obj" ? n.members.some((m) => hasOurs(m.node)) : n.elems.some(hasOurs)));
const hooksAt = (root) => root.members.findIndex((m) => m.key === "hooks");

/**
 * How a text differs from the one that was meant, token by token (space between tokens is not looked at):
 * nothing, or a list of what was lost. "1e400 became null" is a number JavaScript cannot hold written back as
 * null; "a long integer was rounded" is 9007199254740993 written back as ...992; "a number was spelled anew"
 * is 10.0 as 10 and the like; "a string was spelled anew" is an escape written another way; "tokens are
 * missing" is anything else (a key written twice loses its first value).
 */
function lost(meant, got) {
  const a = tokenTexts(meant);
  const b = tokenTexts(got);
  if (a.join("\u0000") === b.join("\u0000")) return [];
  const out = new Set();
  if (a.length !== b.length) out.add("tokens are missing or added (a key written twice, or another value)");
  else
    a.forEach((t, i) => {
      if (t === b[i]) return;
      if (/^-?1e400$/i.test(t) && b[i] === "null") out.add("1e400 became null");
      else if (t === "9007199254740993") out.add("a long integer was rounded");
      else if (t[0] === '"' && b[i][0] === '"') out.add(JSON.parse(t) === JSON.parse(b[i]) ? "a string was spelled anew" : "A STRING CHANGED");
      else if (!Number.isNaN(Number(t)) && Number(t) === Number(b[i])) out.add("a number was spelled anew");
      else out.add("ANOTHER TOKEN CHANGED");
    });
  return [...out].sort();
}

/** Checks (1) to (4). Returns the kinds that failed. */
function checkInstall(O, absO, R, add, command) {
  const fails = [];
  let value;
  try {
    value = JSON.parse(R);
  } catch {
    return ["(1) what was written does not parse"];
  }
  const to = spans(O);
  const tr = spans(R);
  const text = (T, m) => T.slice(m.s, m.node.e);
  const oOthers = to.members.filter((m) => m.key !== "hooks").map((m) => text(O, m));
  const rOthers = tr.members.filter((m) => m.key !== "hooks").map((m) => text(R, m));
  if (oOthers.length !== rOthers.length || oOthers.some((t, i) => t !== rOthers[i])) fails.push("(2) a top-level member other than hooks is not the same text");
  const oh = to.members.filter((m) => m.key === "hooks");
  const rh = tr.members.filter((m) => m.key === "hooks");
  if (rh.length !== 1 || rh[0].node.kind !== "obj") return [...fails, "(4) hooks is not there once, as an object"];
  if (oh.length === 0) {
    let cp = 0;
    while (cp < O.length && O[cp] === R[cp]) cp += 1;
    let cs = 0;
    while (cs < O.length - cp && O[O.length - 1 - cs] === R[R.length - 1 - cs]) cs += 1;
    if (cp + cs < O.length) fails.push("(2) hooks was missing and the file changed in more than one place");
  } else {
    const h = oh[0];
    if (hooksAt(to) !== hooksAt(tr)) fails.push("(2) hooks is not where it was among the keys");
    if (O.slice(0, h.node.s) !== R.slice(0, h.node.s)) fails.push("(2) the text before hooks' value is not the same");
    const tail = O.slice(h.node.e);
    if (R.slice(R.length - tail.length) !== tail) fails.push("(2) the text after hooks' value is not the same");
  }
  // What hooks should now hold, event by event.
  const expected = [];
  if (oh.length > 0) {
    const absHooks = absO.members[hooksAt(to)].node;
    oh[0].node.members.forEach((m, i) => {
      const absList = absHooks.members[i].node;
      const elems = [];
      let had = false;
      m.node.elems.forEach((el, j) => {
        const a = absList.elems[j];
        if (a.ours === "pure") had = true;
        else if (a.ours === "joined") {
          had = true;
          elems.push({ abs: withoutOurs(a) });
        } else elems.push({ text: O.slice(el.s, el.e) });
      });
      if (Object.hasOwn(add, m.key)) elems.push({ value: add[m.key] });
      if (elems.length === 0 && had) return;
      expected.push({ key: m.key, elems });
    });
  }
  for (const key of Object.keys(add)) if (!expected.some((e) => e.key === key)) expected.push({ key, elems: [{ value: add[key] }] });
  const got = rh[0].node.members;
  const gotKeys = got.map((m) => m.key);
  if (new Set(gotKeys).size !== gotKeys.length) fails.push("(4) hooks names an event twice");
  for (const key of gotKeys) if (!expected.some((e) => e.key === key)) fails.push("(4) an event is there that should not be");
  if (expected.every((e) => gotKeys.includes(e.key)) && expected.map((e) => e.key).join("\u0000") !== gotKeys.join("\u0000")) fails.push("(3) soft: the events are all there, in another order");
  for (const e of expected) {
    const m = got.find((x) => x.key === e.key);
    if (m === undefined) {
      fails.push("(3) an event that should be there is not");
      continue;
    }
    if (m.node.kind !== "arr" || m.node.elems.length !== e.elems.length) {
      fails.push("(3) an event's list does not hold the entries it should (count)");
      continue;
    }
    e.elems.forEach((want, j) => {
      const have = R.slice(m.node.elems[j].s, m.node.elems[j].e);
      if (want.text !== undefined) {
        if (have !== want.text) fails.push("(3) an entry that was there is not the same text");
      } else if (want.value !== undefined) {
        if (!same(JSON.parse(have), want.value)) fails.push("(4) grooph's entry is not the expected one");
      } else {
        for (const what of lost(emit(want.abs, "compact"), have)) fails.push(`(3) an entry grooph's command was joined into: of somebody's own commands in it, ${what}`);
      }
    });
  }
  // Once each, counted in the parsed result.
  let n = 0;
  for (const list of Object.values(value.hooks ?? {})) for (const entry of Array.isArray(list) ? list : []) for (const h of Array.isArray(entry?.hooks) ? entry.hooks : []) if (h?.command === command) n += 1;
  if (n !== Object.keys(add).length) fails.push(`(4) grooph's command is there ${n < Object.keys(add).length ? "fewer" : "more"} times than its events`);
  return fails;
}

/**
 * What remove should leave, as an abstract value. As stated: grooph's entries go, an event that held only them
 * goes, hooks goes when that emptied it or when it was there and empty. With `emptied` (the events grooph added
 * to in this sequence): an event that was there with an EMPTY list goes too, which nothing states.
 */
function afterRemove(absO, emptied = []) {
  const members = absO.members.flatMap((m) => {
    if (JSON.parse(m.key) !== "hooks") return [m];
    const events = m.node.members.flatMap((ev) => {
      const had = ev.node.elems.some((e) => e.ours !== undefined) || (ev.node.elems.length === 0 && emptied.includes(JSON.parse(ev.key)));
      const node = withoutOurs(ev.node);
      return had && node.elems.length === 0 ? [] : [{ key: ev.key, node }];
    });
    return events.length === 0 ? [] : [{ key: m.key, node: { k: "obj", members: events } }];
  });
  return { k: "obj", members };
}

/** Check (6). `added`: every event grooph added to in this sequence. */
function checkRemove(O, absO, R, added) {
  if (R === O) return { fails: [], letter: true };
  try {
    JSON.parse(R);
  } catch {
    return { fails: ["(6) after remove the file does not parse"], letter: false };
  }
  const to = spans(O);
  const at = hooksAt(to);
  const others = (T, root) => root.members.filter((m) => m.key !== "hooks").map((m) => T.slice(m.s, m.node.e));
  const fails = [];
  if (others(O, to).join("\u0000") !== others(R, spans(R)).join("\u0000")) fails.push("(6) after remove a top-level member other than hooks is not the same text");
  const ours = hasOurs(absO);
  const stated = emit(afterRemove(absO), "compact");
  const asCoded = emit(afterRemove(absO, added), "compact");
  const with_ = ours ? "an earlier install's entries were in the file; " : "";
  if (lost(stated, R).length === 0) {
    // The same tokens as the stated rule gives. With nothing of grooph's in the file to begin with, the bytes should have come back too.
    if (ours) return { fails, letter: false, tokens: true };
    const why = at < 0 ? (to.members.length === 0 ? "the file was an empty object with space in it" : "hooks was not there") : to.members[at].node.members.length === 0 ? "hooks was there and empty (the stated exception)" : "only the space between tokens differs";
    return { fails: [...fails, `(6) install then remove did not give the bytes back: ${why}`], letter: false };
  }
  const left = lost(asCoded, R);
  if (left.length === 0) return { fails: [...fails, `(6) ${with_}install then remove did not give the file back: an event grooph adds to was there with an EMPTY list, and is gone (not stated)`], letter: false };
  for (const what of left) fails.push(`(6) ${with_}after remove, beyond the empty lists: ${what}`);
  return { fails, letter: false };
}

const VARIANTS = [
  { harnesses: ["claude-code"], tools: false },
  { harnesses: ["claude-code"], tools: true },
  { harnesses: ["codex"], tools: false },
  { harnesses: ["codex"], tools: true },
  { harnesses: ["claude-code", "codex"], tools: false },
  { harnesses: ["claude-code", "codex"], tools: true },
];
const fileOf = (env, harness) => (harness === "claude-code" ? join(env.CLAUDE_CONFIG_DIR, "settings.json") : join(env.CODEX_HOME, "hooks.json"));
const hookOf = (env) => join(env.GROOPH_HOME, "hooks", "grooph-event.mjs");
const words = (r) => (r.err.split("\n").find((l) => l.startsWith("grooph:")) ?? r.err.split("\n")[0] ?? "").replaceAll(S, "<S>").replace(/<S>\/[^ :]+/g, "<file>");

let serial = 0;
/**
 * One sequence for one case. `files`: harness -> { O, abs }. `steps` after the first install: a list of
 * { env?, tools } installs to make before the remove. The last install is the one checked.
 */
async function sequence(seq, id, variant, given, later) {
  let files;
  counts.sequences += 1;
  let clean = true;
  const bad = (kind, text) => {
    clean = false;
    fail(`${seq}: ${kind}`, text, id);
  };
  const name = `s${(serial += 1)}`;
  const env = person(name);
  // An entry "of this very install" in a generated text names this person's GROOPH_HOME.
  files = Object.fromEntries(Object.entries(given).map(([h, f]) => [h, { O: f.O.replaceAll("@HOME@", env.GROOPH_HOME), abs: JSON.parse(JSON.stringify(f.abs).replaceAll("@HOME@", env.GROOPH_HOME)) }]));
  for (const h of variant.harnesses) {
    mkdirSync(dirname(fileOf(env, h)), { recursive: true });
    writeFileSync(fileOf(env, h), files[h].O);
  }
  const install = async (e, tools) => {
    counts.runs += 1;
    counts.installs += 1;
    return run(e, ["hooks", "install", "--user", "--harness", variant.harnesses.join(","), ...(tools ? ["--tools"] : [])]);
  };
  const now = (h) => readFileSync(fileOf(env, h), "utf8");
  const refused = (r, before, step) => {
    counts.refusals += 1;
    // Named by the text the case began with; compared with what stood there just before the refused step.
    for (const h of variant.harnesses) {
      bad(`${step} REFUSED: "${words(r)}"`, files[h].O);
      if (now(h) !== before[h]) bad(`${step} refused and the file was CHANGED all the same`, files[h].O);
    }
  };
  try {
    let at = { env, tools: variant.tools };
    let before = Object.fromEntries(variant.harnesses.map((h) => [h, files[h].O]));
    let r = await install(at.env, at.tools);
    if (r.status !== 0) return refused(r, before, "the first install");
    for (const step of later) {
      before = Object.fromEntries(variant.harnesses.map((h) => [h, now(h)]));
      at = { env: step.env ? step.env(env) : env, tools: step.tools };
      r = await install(at.env, at.tools);
      if (r.status !== 0) return refused(r, before, `the ${step.what}`);
      if (r.out.includes("could not") || r.err !== "") bad(`the ${step.what} said something on standard error`, files[variant.harnesses[0]].O);
    }
    for (const h of variant.harnesses) {
      const add = expectedEntries(hookOf(at.env), h, at.tools);
      counts.installChecked += 1;
      for (const kind of checkInstall(files[h].O, files[h].abs, now(h), add, `node "${hookOf(at.env)}" ${h} --user`)) bad(kind, files[h].O);
    }
    // (5)
    before = Object.fromEntries(variant.harnesses.map((h) => [h, now(h)]));
    r = await install(at.env, at.tools);
    counts.second += 1;
    if (r.status !== 0) refused(r, before, "the install run again");
    else if (variant.harnesses.every((h) => now(h) === before[h])) counts.secondSame += 1;
    else bad("(5) the install run again changed the file", files[variant.harnesses[0]].O);
    // (6)
    counts.runs += 1;
    counts.removes += 1;
    r = await run(at.env, ["hooks", "remove", "--user", "--harness", variant.harnesses.join(",")]);
    if (r.status !== 0) {
      counts.refusals += 1;
      bad(`remove REFUSED: "${words(r)}"`, files[variant.harnesses[0]].O);
      return;
    }
    for (const h of variant.harnesses) {
      const got = checkRemove(files[h].O, files[h].abs, now(h), [...new Set([variant.tools, ...later.map((step) => step.tools)].flatMap((tools) => Object.keys(expectedEntries("x", h, tools))))]);
      if (got.letter) counts.removeToTheLetter += 1;
      if (got.tokens) counts.removeExpectedTokens += 1;
      for (const kind of got.fails) bad(kind, files[h].O);
    }
  } finally {
    if (clean) counts.cleanSequences += 1;
    rmSync(join(S, name), { recursive: true, force: true });
  }
}

async function oneCase(id, variant, files) {
  counts.texts += variant.harnesses.length;
  await sequence("base", id, variant, files, []);
  await sequence("switch", id, variant, files, [{ what: "install with --tools the other way", tools: !variant.tools }]);
  await sequence("moved", id, variant, files, [{ what: "install with GROOPH_HOME moved", tools: variant.tools, env: (e) => ({ ...e, GROOPH_HOME: `${e.GROOPH_HOME}-2` }) }]);
}

// ─── The cases ────────────────────────────────────────────────────────────
const SMALL_TEXTS = [
  "{}", "{ }", "{\n}", "{\n}\n", " {} ", "{}\n", '{"hooks":{}}', '{"hooks":{ }}', '{"hooks": {}}', '{\n  "hooks": {}\n}\n', '{"hooks":{"Stop":[]}}', '{"hooks":{"Stop":[ ]}}', '{"hooks":{"Other":[]}}',
  '{"hooks":{"Stop":[],"Other":[]}}', '{"a":1}', '{"a":1,"hooks":{}}', '{"hooks":{},"a":1}', '{"a":1,"hooks":{},"b":2}', '{\n  "hooks": {},\n  "a": 1\n}\n', '{\n  "a": 1,\n  "hooks": {}\n}\n',
  '{"hooks":{"Stop":[{"hooks":[{"type":"command","command":"x"}]}]}}', '{"hooks":{"Stop":[1]}}', '{"a":1e400}', '{"a":1,"a":2}', '{"\\u0068ooks":{}}', '{"hooks":{},"hooks2":1}',
  '{"hooks":{"Other":[1]},"a":1}', '{\n  "hooks": {\n    "Stop": []\n  }\n}\n', '{\n  "hooks": {\n    "Other": []\n  },\n  "z": 1\n}\n', '{"a":{"hooks":{"Stop":[]}}}', '{"a":"\\"hooks\\":{}"}',
  '{"hooks":{"Stop":[]},"a":1}', '{"hooks":{"Stop":[],"Other":[1]}}', '{"hooks":{"Other":[1],"Stop":[]}}', '{\n  "hooks": {\n    "Stop": []\n  },\n  "model": "opus"\n}\n',
  '{\r\n  "a": 1\r\n}\r\n', '{\n\t"a": 1\n}', '{"a":1}\n\n\n', '\n\n{"a":1}', '{"hooks":{"Stop":[{"hooks":[{"type":"command","command":"x"}]}]},"a":1}', '{"a":[],"b":{}}', '{"":""}', '{"__proto__":{"hooks":1}}',
];

const jobs = [];
if (SMALL) {
  SMALL_TEXTS.forEach((text, i) => {
    for (const variant of VARIANTS.slice(0, 4)) jobs.push(() => oneCase(`small #${i} ${variant.harnesses.join(",")}${variant.tools ? " --tools" : ""}`, variant, { [variant.harnesses[0]]: { O: text, abs: absFromText(text) } }));
  });
} else {
  for (let i = 0; i < COUNT; i += 1) {
    const r = rng(SEED * 1_000_003 + i);
    const variant = r.pick(VARIANTS);
    const files = {};
    let said = "";
    for (const h of variant.harnesses) {
      const shape = r.pick(["none", "first", "middle", "last", "only", "first", "middle", "last"]);
      const withOurs = r.chance(0.3);
      const style = r.pick(STYLES);
      const abs = settingsValue(r, { hooks: shape, withOurs, home: "@HOME@" });
      files[h] = { O: emit(abs, style, r), abs };
      said += ` ${h}:${shape}/${style}${withOurs ? "/ours" : ""}`;
    }
    jobs.push(() => oneCase(`seed ${SEED} case ${i}${variant.tools ? " --tools" : ""}${said}`, variant, files));
  }
}
// The model's own texts must be JSON, or the fuzz would be testing the generator.
let next = 0;
const worker = async () => {
  while (next < jobs.length) {
    const job = jobs[(next += 1) - 1];
    await job();
  }
};
const started = Date.now();
await Promise.all(Array.from({ length: JOBS }, worker));

console.log(`\n${SMALL ? `small cases: ${SMALL_TEXTS.length} texts × 4 option sets` : `seed ${SEED}, ${COUNT} cases`}: ${counts.texts} settings texts, ${counts.sequences} sequences, ${counts.runs} runs of grooph in ${Math.round((Date.now() - started) / 1000)} s`);
console.log(`sequences with nothing to say: ${counts.cleanSequences} of ${counts.sequences}`);
console.log(`files checked after an install, (1) to (4): ${counts.installChecked}`);
console.log(`(5) install run again left every file as it was: ${counts.secondSame} of ${counts.second}`);
console.log(`(6) remove gave back the bytes: ${counts.removeToTheLetter} files; the expected tokens without an earlier install's entries: ${counts.removeExpectedTokens} files; of ${counts.removes} removes`);
console.log(`refusals (exit not 0): ${counts.refusals}`);
console.log("\nkinds, most first, each with the smallest text that showed it:");
for (const [kind, k] of [...kinds].sort((a, b) => b[1].n - a[1].n)) {
  console.log(`\n${String(k.n).padStart(5)} × ${kind}`);
  console.log(`        ${k.smallest.where}`);
  console.log(`        ${JSON.stringify(k.smallest.text.length > 700 ? `${k.smallest.text.slice(0, 700)}… (${k.smallest.text.length} characters)` : k.smallest.text)}`);
}
if (kinds.size === 0) console.log("  none");
// The same, the three sequences taken together.
const together = new Map();
for (const [kind, k] of kinds) {
  const bare = kind.replace(/^(base|switch|moved): /, "").replace(/the (first install|install run again|install with --tools the other way|install with GROOPH_HOME moved) REFUSED/, "an install REFUSED");
  together.set(bare, (together.get(bare) ?? 0) + k.n);
}
console.log("\nthe same kinds, the three sequences together:");
for (const [kind, count] of [...together].sort((a, b) => b[1] - a[1])) console.log(`${String(count).padStart(5)} × ${kind}`);

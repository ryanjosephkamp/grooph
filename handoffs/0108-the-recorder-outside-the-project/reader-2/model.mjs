/**
 * Second reader, slice 0108. A model of JSON text written apart from grooph's code: a tokenizer by one regular
 * expression, a tree of spans built from the tokens, a generator of settings texts in many legal layouts, and
 * the checks the fuzz applies. Nothing here imports anything of grooph's.
 */

// ─── A seeded source of numbers, so a failing case can be made again ──────
export function rng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const r = {
    next,
    int: (n) => Math.floor(next() * n),
    pick: (list) => list[Math.floor(next() * list.length)],
    chance: (p) => next() < p,
  };
  return r;
}

// ─── Tokens and spans ─────────────────────────────────────────────────────
const TOKEN = /[ \t\n\r]*("(?:[^"\\]|\\[\s\S])*"|[{}\[\],:]|[^ \t\n\r{}\[\],:"]+)/y;

/** Every token of a JSON text with where it starts and ends. Throws on anything left over. */
export function tokens(text) {
  const out = [];
  TOKEN.lastIndex = 0;
  let at = 0;
  for (;;) {
    TOKEN.lastIndex = at;
    const m = TOKEN.exec(text);
    if (m === null) break;
    const e = TOKEN.lastIndex;
    out.push({ t: m[1], s: e - m[1].length, e });
    at = e;
  }
  if (!/^[ \t\n\r]*$/.test(text.slice(at))) throw new Error(`model: not tokens from ${at}: ${JSON.stringify(text.slice(at, at + 30))}`);
  return out;
}

/** The token texts alone: two texts with the same list say the same thing, written the same way but for the space between. */
export const tokenTexts = (text) => tokens(text).map((t) => t.t);

/**
 * A tree of spans: { kind: "obj", s, e, members: [{ key, keyRaw, s, node }] } | { kind: "arr", s, e, elems: [node] } |
 * { kind: "atom", s, e }. `s` of a member is where its key begins.
 */
export function spans(text) {
  const toks = tokens(text);
  let i = 0;
  const value = () => {
    const tok = toks[i];
    if (tok === undefined) throw new Error("model: ran out of tokens");
    if (tok.t === "{") {
      i += 1;
      const members = [];
      while (toks[i].t !== "}") {
        const k = toks[i];
        if (k.t[0] !== '"') throw new Error(`model: a key was expected at ${k.s}`);
        if (toks[i + 1].t !== ":") throw new Error(`model: a colon was expected after ${k.t}`);
        i += 2;
        const node = value();
        members.push({ key: JSON.parse(k.t), keyRaw: k.t, s: k.s, node });
        if (toks[i].t === ",") i += 1;
      }
      const e = toks[i].e;
      i += 1;
      return { kind: "obj", s: tok.s, e, members };
    }
    if (tok.t === "[") {
      i += 1;
      const elems = [];
      while (toks[i].t !== "]") {
        elems.push(value());
        if (toks[i].t === ",") i += 1;
      }
      const e = toks[i].e;
      i += 1;
      return { kind: "arr", s: tok.s, e, elems };
    }
    i += 1;
    return { kind: "atom", s: tok.s, e: tok.e };
  };
  const root = value();
  if (i !== toks.length) throw new Error("model: tokens after the value");
  return root;
}

// ─── What install --user is meant to add (written down from docs/subagents.md and one fresh install, not imported) ──
export function expectedEntries(hookPath, harness, tools) {
  const command = `node "${hookPath}" ${harness} --user`;
  const bg = () => ({ type: "command", command, async: true, timeout: 10 });
  const fg = (timeout) => ({ type: "command", command, timeout });
  const add = {
    SessionStart: { hooks: [bg()] },
    SessionEnd: { hooks: [fg(3)] },
    UserPromptSubmit: { hooks: [bg()] },
    Stop: { hooks: [fg(5)] },
    SubagentStart: { hooks: [bg()] },
    SubagentStop: { hooks: [bg()] },
  };
  if (tools) add.PostToolUse = { hooks: [bg()] };
  else if (harness === "claude-code") add.PostToolUse = { matcher: "Agent", hooks: [bg()] };
  return add;
}

/** Deep equality of two JSON values, whatever order their keys are in. */
export function same(a, b) {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) return a.length === b.length && a.every((v, i) => same(v, b[i]));
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => Object.hasOwn(b, k) && same(a[k], b[k]));
}

// ─── The generator ────────────────────────────────────────────────────────
// An abstract value: { k: "obj", members: [{ key (raw text, quoted), node }] } | { k: "arr", elems } | { k: "atom", raw }.
// A list element in "hooks" may carry `ours`: "pure" (an entry only grooph's) or "joined" (grooph's command beside
// somebody's), and a command object inside a joined entry carries `oursCommand: true`.

const atom = (raw) => ({ k: "atom", raw });
const q = (s) => JSON.stringify(s);

/** String texts as they may be written in a file, escapes and all. Each is a whole JSON string token. */
const NASTY = [
  '""', '"hooks"', '"\\"hooks\\""', '"{\\"hooks\\": {}}"', '"}"', '"{"', '"]"', '"["', '","', '":"', '", \\"hooks\\": {"', '"\\\\"', '"\\\\\\""', '"a\\\\"', '"\\\\\\\\"',
  '"\\u0068ooks"', '"\\u0022"', '"\\u005c"', '"\\ud83d\\ude00"', '"\\ud800"', '"\\/"', '"a\\/b"', '"é"', '"\\u00e9"', '"日本語"', '"😀"', '"\\n\\t\\r\\b\\f"', '"tab\\there"',
  '"  spaced  "', '"/hooks/grooph-event.mjs"', '"grooph-event.mjs"', '"node \\"x\\" claude-code --user"', '"\u2028"', '"\u00a0"', '"\ufeff"', '"//not a comment"', '"/* nor this */"',
  '"}],\\"hooks\\":{\\"Stop\\":[{"', '"null"', '"true"', '"1e400"', '"__proto__"', '"line1\\nline2"', '"C:\\\\Users\\\\me"', '"a,b"', '"x: y"', '"[1, 2]"',
];
const NUMBERS = ["0", "-0", "1", "-1", "1e400", "-1e400", "1E400", "9007199254740993", "12345678901234567890123", "1.0", "1.10", "0.1e-5", "1E+2", "1e-400", "0.0", "100", "3.14159", "5e0", "-0.0", "0e0"];
const WORDS = ["null", "true", "false"];
const KEYS = [
  '"model"', '"env"', '"permissions"', '"theme"', '"apiKeyHelper"', '"statusLine"', '"includeCoAuthoredBy"', '""', '"__proto__"', '"constructor"', '"toString"', '"hasOwnProperty"', '"1"', '"0"', '"10"',
  '"hooks "', '" hooks"', '"Hooks"', '"hook"', '"hooks2"', '"a b"', '"é"', '"\\u00e9"', '"a\\"b"', '"a\\\\"', '"{"', '"}"', '"["', '":"', '","', '"x"', '"y"', '"z"', '"allow"', '"deny"', '"$schema"',
];
const NESTED_KEYS = [...KEYS, '"hooks"', '"hooks"', '"\\u0068ooks"', '"Stop"', '"command"'];
const SOMEBODYS = [
  "echo hi", "~/bin/notify.sh", "node \"/opt/tools/lint.mjs\" --fix", "bash -c 'echo \"{}\"'", "jq '.hooks' < ~/.claude/settings.json", "printf '%s\\n' \"}]\"", "say done", "python3 -c \"print('{')\"",
  "echo \"a\\\\b\"", "node \"$CLAUDE_PROJECT_DIR/tools/check.mjs\"", "C:\\tools\\run.exe \"x\"", "echo é 日本 😀", "true", "",
];
const OTHER_EVENTS = ['"PreToolUse"', '"Notification"', '"PreCompact"', '""', '"__proto__"', '"constructor"', '"hooks"', '"stop"', '"Stop "', '"1"', '"0"', '"SessionStart "', '"sessionStart"', '"\\u0050reToolUse2"'];
const OUR_EVENTS = ['"SessionStart"', '"SessionEnd"', '"UserPromptSubmit"', '"Stop"', '"SubagentStart"', '"SubagentStop"', '"PostToolUse"', '"\\u0053top"', '"Sto\\u0070"'];

function anyValue(r, depth) {
  const roll = r.next();
  if (depth <= 0 || roll < 0.35) {
    const kind = r.next();
    if (kind < 0.45) return atom(r.pick(NASTY));
    if (kind < 0.8) return atom(r.pick(NUMBERS));
    return atom(r.pick(WORDS));
  }
  if (roll < 0.7) {
    const n = r.int(5);
    const members = [];
    for (let i = 0; i < n; i += 1) members.push({ key: r.pick(NESTED_KEYS), node: anyValue(r, depth - 1) });
    // A key written twice, now and then.
    if (n > 0 && r.chance(0.2)) members.push({ key: members[0].key, node: anyValue(r, depth - 1) });
    return { k: "obj", members };
  }
  const n = r.int(5);
  const elems = [];
  for (let i = 0; i < n; i += 1) elems.push(anyValue(r, depth - 1));
  return { k: "arr", elems };
}

/** A string token for a command, written plainly or with escapes JSON allows that say the same thing. */
function commandToken(r, command) {
  let text = q(command);
  if (r.chance(0.15)) text = text.replaceAll("/", "\\/");
  if (r.chance(0.1)) text = text.replace("node", "\\u006eode");
  if (r.chance(0.1)) text = text.replace("grooph", "groo\\u0070h");
  return text;
}

function commandObject(r, command, { ours = false } = {}) {
  const members = [{ key: '"type"', node: atom('"command"') }, { key: '"command"', node: atom(commandToken(r, command)) }];
  if (r.chance(0.4)) members.push({ key: '"async"', node: atom("true") });
  if (r.chance(0.6)) members.push({ key: '"timeout"', node: atom(r.pick(["10", "5", "3", "60", "1e400", "10.0", "9007199254740993", "1E1"])) });
  if (!ours && r.chance(0.15)) members.push({ key: '"timeout"', node: atom("7") }); // a key twice
  if (r.chance(0.2)) members.reverse();
  const node = { k: "obj", members };
  if (ours) node.oursCommand = true;
  return node;
}

/** Folders an earlier install might have kept its hook in. */
const OLD_HOMES = ["/Users/me/.grooph", "/old/home/.grooph", "/tmp/a b/.grooph", "C:\\Users\\me\\.grooph", "/Users/é/.grooph", "/x/hooks"];

/** One element of an event's list. `oldHook` is the hook path this very install will write (so an entry "already as written"). */
function listElement(r, ctx) {
  const roll = r.next();
  const entry = (hooks, flag) => {
    const members = [];
    if (r.chance(0.4)) members.push({ key: '"matcher"', node: atom(r.pick(['"Bash"', '"Agent"', '"*"', '""', '"Edit|Write"'])) });
    members.push({ key: '"hooks"', node: { k: "arr", elems: hooks } });
    if (r.chance(0.1)) members.push({ key: r.pick(KEYS), node: anyValue(r, 1) });
    if (r.chance(0.2)) members.reverse();
    const node = { k: "obj", members };
    if (flag) node.ours = flag;
    return node;
  };
  const oursCommand = () => {
    const home = r.chance(0.3) ? ctx.home : r.pick(OLD_HOMES);
    const sepr = home.includes("\\") ? "\\" : "/";
    return `node "${home}${sepr}hooks${sepr}grooph-event.mjs" ${r.pick(["claude-code", "codex"])} --user`;
  };
  if (ctx.withOurs && roll < 0.2) return entry([commandObject(r, oursCommand(), { ours: true })], "pure");
  if (ctx.withOurs && roll < 0.3) {
    const hooks = [commandObject(r, r.pick(SOMEBODYS))];
    hooks.splice(r.int(2), 0, commandObject(r, oursCommand(), { ours: true }));
    if (r.chance(0.3)) hooks.push(commandObject(r, r.pick(SOMEBODYS)));
    return entry(hooks, "joined");
  }
  if (roll < 0.85) {
    const n = 1 + r.int(2);
    const hooks = [];
    for (let i = 0; i < n; i += 1) hooks.push(commandObject(r, r.pick(SOMEBODYS)));
    return entry(hooks);
  }
  // Something a harness would not run, and that is still somebody's to keep.
  if (roll < 0.9) return { k: "obj", members: [{ key: '"hooks"', node: { k: "arr", elems: [atom("null"), atom('"x"'), atom("1")] } }] };
  if (roll < 0.93) return { k: "obj", members: [{ key: '"hooks"', node: atom(r.pick(['"none"', "null", "{}", "1"])) }] };
  return anyValue(r, 2);
}

function hooksValue(r, ctx) {
  const members = [];
  const n = r.pick([0, 0, 1, 1, 2, 3, 5]);
  const used = new Set();
  for (let i = 0; i < n; i += 1) {
    const key = r.chance(0.6) ? r.pick(OUR_EVENTS) : r.pick(OTHER_EVENTS);
    const name = JSON.parse(key);
    if (used.has(name)) continue;
    used.add(name);
    const len = r.pick([0, 0, 1, 1, 1, 2, 3]);
    const elems = [];
    for (let j = 0; j < len; j += 1) elems.push(listElement(r, ctx));
    members.push({ key, node: { k: "arr", elems } });
  }
  return { k: "obj", members };
}

/**
 * A whole settings file as an abstract value. `shape.hooks`: "none" | "first" | "middle" | "last" | "only";
 * `withOurs`: whether entries of an earlier install may be in it; `home`: this install's GROOPH_HOME.
 */
export function settingsValue(r, { hooks, withOurs, home }) {
  const others = [];
  const n = hooks === "only" ? 0 : hooks === "middle" ? 2 + r.int(4) : hooks === "none" ? r.int(6) : 1 + r.int(5);
  const seen = [];
  for (let i = 0; i < n; i += 1) {
    const key = r.pick(KEYS);
    seen.push(key);
    others.push({ key, node: anyValue(r, 3) });
  }
  // A key written twice, outside hooks.
  if (seen.length > 0 && r.chance(0.2)) others.splice(r.int(others.length + 1), 0, { key: r.pick(seen), node: anyValue(r, 2) });
  if (hooks === "none") return { k: "obj", members: others };
  const member = { key: r.chance(0.9) ? '"hooks"' : '"\\u0068ooks"', node: hooksValue(r, { withOurs, home }) };
  const at = hooks === "first" || hooks === "only" ? 0 : hooks === "last" ? others.length : 1 + r.int(others.length - 1);
  others.splice(at, 0, member);
  return { k: "obj", members: others };
}

const CHAOS = ["", "", "", " ", " ", "  ", "\t", "\n", "\r\n", "\n    ", " \n\t ", "\r", "\n\n", "   \t"];

/** The text of an abstract value in a layout. */
export function emit(node, style, r) {
  const pretty = (unit, eol) => {
    const go = (n, d) => {
      if (n.k === "atom") return n.raw;
      const pad = eol + unit.repeat(d + 1);
      const end = eol + unit.repeat(d);
      if (n.k === "obj") return n.members.length === 0 ? "{}" : `{${pad}${n.members.map((m) => `${m.key}: ${go(m.node, d + 1)}`).join(`,${pad}`)}${end}}`;
      return n.elems.length === 0 ? "[]" : `[${pad}${n.elems.map((e) => go(e, d + 1)).join(`,${pad}`)}${end}]`;
    };
    return go(node, 0);
  };
  const flat = (colon, comma, inner) => {
    const go = (n) => {
      if (n.k === "atom") return n.raw;
      if (n.k === "obj") return n.members.length === 0 ? "{}" : `{${inner}${n.members.map((m) => `${m.key}${colon}${go(m.node)}`).join(comma)}${inner}}`;
      return n.elems.length === 0 ? "[]" : `[${inner}${n.elems.map(go).join(comma)}${inner}]`;
    };
    return go(node);
  };
  const chaos = () => {
    const w = () => r.pick(CHAOS);
    const go = (n) => {
      if (n.k === "atom") return n.raw;
      if (n.k === "obj") return `{${w()}${n.members.map((m) => `${m.key}${w()}:${w()}${go(m.node)}${w()}`).join(`,${w()}`)}}`;
      return `[${w()}${n.elems.map((e) => `${go(e)}${w()}`).join(`,${w()}`)}]`;
    };
    return `${w()}${go(node)}${w()}`;
  };
  // Laid out line by line at the top and one level down, then each value on one line: what a person's hand edits leave.
  const mixed = (unit, eol) => {
    const one = (n) => emit(n, "spaced", r);
    if (node.k !== "obj" || node.members.length === 0) return one(node);
    return `{${eol}${node.members.map((m) => `${unit}${m.key}: ${m.node.k === "obj" && m.node.members.length > 0 ? `{${eol}${m.node.members.map((mm) => `${unit}${unit}${mm.key}: ${one(mm.node)}`).join(`,${eol}`)}${eol}${unit}}` : one(m.node)}`).join(`,${eol}`)}${eol}}`;
  };
  switch (style) {
    case "compact": return flat(":", ",", "");
    case "spaced": return flat(": ", ", ", "");
    case "padded": return flat(": ", ", ", " ");
    case "pretty2": return `${pretty("  ", "\n")}\n`;
    case "pretty4": return `${pretty("    ", "\n")}\n`;
    case "pretty1": return pretty(" ", "\n");
    case "pretty12": return `${pretty("            ", "\n")}\n`;
    case "tab": return `${pretty("\t", "\n")}\n`;
    case "crlf": return `${pretty("  ", "\r\n")}\r\n`;
    case "crlftab": return pretty("\t", "\r\n");
    case "noindent": return `${pretty("", "\n")}\n`;
    case "mixed2": return `${mixed("  ", "\n")}\n`;
    case "mixedcrlf": return mixed("    ", "\r\n");
    case "chaos": return chaos();
    default: throw new Error(`model: no style ${style}`);
  }
}
export const STYLES = ["compact", "spaced", "padded", "pretty2", "pretty2", "pretty4", "pretty1", "pretty12", "tab", "crlf", "crlftab", "noindent", "mixed2", "mixedcrlf", "chaos", "chaos", "chaos"];

/** The abstract value with grooph's own taken out, as install and remove are said to take them: a pure entry goes, a joined entry loses grooph's command. */
export function withoutOurs(node) {
  if (node.k === "atom") return node;
  if (node.k === "obj") return { ...node, members: node.members.map((m) => ({ key: m.key, node: withoutOurs(m.node) })) };
  return { ...node, elems: node.elems.filter((e) => e.ours !== "pure" && e.oursCommand !== true).map(withoutOurs) };
}

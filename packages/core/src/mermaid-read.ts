/**
 * Mermaid read into a graph document: the reverse of `mermaid.ts`, for a stated subset of Mermaid's
 * `flowchart` (or `graph`) and `agentflow-beta` text. What it reads is said in {@link MERMAID_SUBSET}; anything
 * else is refused with a message naming what it met. What the text cannot say (a brief, an agent's outputs, a
 * gate's question) is filled in, and every such guess is reported, one line each.
 *
 *   flowchart: a node's shape says its kind, the reverse of the export; `{ }` critic, `{{ }}` check,
 *     `[/ \]` human gate, `(( ))` merge, `((( )))` stop, anything else an agent
 *   agentflow: a flow is an agent (its `model` and `instruction` carried over), an action is a person's step,
 *     a decision is a check, an input is the goal
 *   a cycle becomes a loop; in grooph's own export a loop's subgraph, its dotted way back and its stops note say
 *     which, and the loop's stops come back from the note
 */

import { overLimit } from "./limits.js";
import { parseGraph } from "./parse.js";
import type { AgentNode, BudgetMeasure, Edge, EdgeWhen, Graph, Group, Id, Loop, Node, Role, Stop } from "./types.js";

/** What the reader reads, for a refusal and for the help. */
export const MERMAID_SUBSET =
  "flowchart, graph and agentflow-beta text: nodes with their shapes and labels, edges with their labels, subgraphs and flows, @{ … } metadata, and %% comments (style, class and click lines are read and left out)";

export type MermaidReadOptions = {
  /** the graph's name when the text does not carry one, such as the file's name */
  name?: string;
};

export type MermaidRead =
  | { ok: true; doc: Graph; guesses: string[] }
  | { ok: false; error: string; line?: number };

class Refusal extends Error {
  constructor(message: string, readonly line?: number) {
    super(message);
  }
}

// ─── reading the text ─────────────────────────────────────────────────────

type Shape =
  | "rect" | "round" | "stadium" | "subroutine" | "cylinder" | "circle" | "double-circle" | "diamond" | "hexagon"
  | "trapezoid" | "inv-trapezoid" | "lean-right" | "lean-left" | "asymmetric" | "plain";

type RawNode = {
  id: string;
  label?: string;
  shape?: Shape;
  /** `shape:` from metadata, as written */
  named?: string;
  classes: string[];
  meta: Map<string, string>;
  /** the innermost container it was first named in */
  parent?: number;
  line: number;
};

type Container = { id: string; label: string; kind: "subgraph" | "flow" | "global"; parent?: number; line: number };

type RawEdge = { from: string; to: string; label?: string; dotted: boolean; head: ">" | "x" | "o" | ""; reference: boolean; invisible: boolean; line: number };

type Reading = {
  kind: "flowchart" | "agentflow";
  nodes: Map<string, RawNode>;
  containers: Container[];
  edges: RawEdge[];
  comments: string[];
  /** lines read and left out, by keyword */
  skipped: Map<string, number>;
  /** the ids edges were given (`e1@-->`), whose `e1@{ … }` lines are an edge's and not a node's */
  edgeIds: Set<string>;
  /** what `class a,b name` lines gave, by id; they make no node */
  classes: Map<string, string[]>;
};

const ENTITIES: Record<string, string> = { quot: '"', lt: "<", gt: ">", amp: "&", apos: "'", nbsp: " " };

/** Mermaid's entities (`#35;`, `#quot;`) as the characters they stand for, in one pass, so `#35;quot;` stays `#quot;`. */
const entities = (raw: string): string =>
  raw.replace(/#(\d+|[a-z]+);/gi, (whole, name: string) => {
    if (/^\d+$/.test(name)) return String.fromCodePoint(Math.min(Number(name), 0x10ffff));
    const lower = name.toLowerCase();
    return Object.hasOwn(ENTITIES, lower) ? ENTITIES[lower]! : whole;
  });

/** A label's text: `<br>` a line break, entities decoded, markdown backticks off, white space folded. */
function text(raw: string): string {
  let t = raw.trim();
  if (t.length >= 2 && t.startsWith('"') && t.endsWith('"')) t = t.slice(1, -1);
  if (t.length >= 2 && t.startsWith("`") && t.endsWith("`")) t = t.slice(1, -1);
  return entities(t.replace(/<br\s*\/?>/gi, "\n"))
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line !== "")
    .join("\n");
}

/** A node's id: letters, digits and `_`, with single `-` or `.` between. */
const ID = /[\p{L}\p{N}_]+(?:[-.][\p{L}\p{N}_]+)*/uy;

/** Run a sticky pattern at `at`. */
function at(pattern: RegExp, s: string, from: number): RegExpExecArray | null {
  pattern.lastIndex = from;
  return pattern.exec(s);
}

/**
 * How much the reader takes before it refuses. The text is someone else's, so nothing in reading it may grow with it
 * faster than its length: a label or a block is held to a hundred lines, and a chain's label to two thousand
 * characters. The size of what it makes is held to grooph's caps once it is read; these keep the reading itself short.
 */
const READ_LIMITS = { text: 1_000_000, statementLines: 100, middleLabel: 2_000, nodes: 5_000, edges: 20_000, boxes: 1_000, depth: 100 } as const;

/** The brackets of a flowchart shape, longest opener first; an opener two shapes share closes at whichever comes first. */
const BRACKETS: [open: string, closes: [close: string, shape: Shape][]][] = [
  ["(((", [[")))", "double-circle"]]],
  ["((", [["))", "circle"]]],
  ["([", [["])", "stadium"]]],
  ["[[", [["]]", "subroutine"]]],
  ["[(", [[")]", "cylinder"]]],
  ["{{", [["}}", "hexagon"]]],
  ["[/", [["\\]", "trapezoid"], ["/]", "lean-right"]]],
  ["[\\", [["/]", "inv-trapezoid"], ["\\]", "lean-left"]]],
  ["[", [["]", "rect"]]],
  ["(", [[")", "round"]]],
  ["{", [["}", "diamond"]]],
  [">", [["]", "asymmetric"]]],
];

/**
 * Where a quoted run that opens at `at` ends: the index just past its closing quote, or the text's length. In a
 * label a backslash is a character; in metadata, whose strings are YAML's, it escapes the next one.
 */
function pastQuote(s: string, from: number, escapes = false): number {
  for (let i = from + 1; i < s.length; i++) {
    if (escapes && s[i] === "\\") i++;
    else if (s[i] === '"') return i + 1;
  }
  return s.length;
}

/**
 * A walk over a statement that knows where quotes, `@{ … }` blocks and an edge's `|label|` are: `visit` sees each
 * character outside them, with its index and the depth of brackets around it. Returns whether a quote or a block is
 * left open.
 */
function walk(s: string, visit: (c: string, i: number, depth: number) => void = () => {}): boolean {
  let meta = 0;
  let depth = 0;
  let pipe = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (c === '"') {
      const end = pastQuote(s, i, meta > 0);
      if (end === s.length && (s[end - 1] !== '"' || end - 1 === i)) return true;
      i = end - 1;
    } else if (meta > 0) {
      if (c === "{") meta++;
      else if (c === "}") meta--;
    } else if (c === "@" && s[i + 1] === "{") {
      meta = 1;
      i++;
    } else if (c === "|" && depth === 0 && (pipe || /[->=.ox]\s*$/.test(s.slice(Math.max(0, i - 24), i)))) pipe = !pipe;
    else if (!pipe) {
      if ("[({".includes(c)) depth++;
      else if ("])}".includes(c)) depth = Math.max(0, depth - 1);
      visit(c, i, depth);
    }
  }
  return meta > 0;
}

/** A shape's bracket at `from`, if one opens there: its shape, its label, and where it ends. */
function readBracket(s: string, from: number, line: number): { shape: Shape; label: string; end: number } | undefined {
  for (const [open, closes] of BRACKETS) {
    if (!s.startsWith(open, from)) continue;
    let i = from + open.length;
    while (s[i] === " ") i++;
    if (s[i] === '"') {
      const q = pastQuote(s, i);
      let j = q;
      while (s[j] === " ") j++;
      const close = closes.find(([c]) => s.startsWith(c, j));
      if (close) return { shape: close[1], label: s.slice(i, q), end: j + close[0].length };
      continue;
    }
    // An unquoted label ends at the first close any of its shapes has.
    let best: { shape: Shape; end: number; close: string } | undefined;
    for (const [close, shape] of closes) {
      const end = s.indexOf(close, from + open.length);
      if (end >= 0 && (!best || end < best.end)) best = { shape, end, close };
    }
    if (best) return { shape: best.shape, label: s.slice(from + open.length, best.end), end: best.end + best.close.length };
  }
  if (from < s.length && "[({>".includes(s[from]!)) throw new Refusal(`a node's brackets that do not close: ${clipText(s.slice(from))}`, line);
  return undefined;
}

/** The value of a YAML double-quoted string from `from` (its opening quote): what it says, and where it ends. */
function doubleQuoted(body: string, from: number): { value: string; end: number } {
  const ESCAPED: Record<string, string> = { n: "\n", t: "\t", r: "\r", b: "\b", f: "\f", "0": "\0", a: "\x07", v: "\v", e: "\x1b", " ": " ", "/": "/", '"': '"', "\\": "\\", N: "\x85", _: "\xa0", L: " ", P: " " };
  let value = "";
  let i = from + 1;
  for (; i < body.length && body[i] !== '"'; i++) {
    if (body[i] !== "\\") {
      value += body[i];
      continue;
    }
    const next = body[++i] ?? "";
    const hex = next === "x" ? 2 : next === "u" ? 4 : next === "U" ? 8 : 0;
    if (hex > 0) {
      const code = /^[0-9a-fA-F]+$/.test(body.slice(i + 1, i + 1 + hex)) ? parseInt(body.slice(i + 1, i + 1 + hex), 16) : 0xfffd;
      value += String.fromCodePoint(Math.min(code, 0x10ffff));
      i += hex;
    } else value += Object.hasOwn(ESCAPED, next) ? ESCAPED[next]! : next;
  }
  return { value, end: i + 1 };
}

/**
 * A `@{ … }` block's keys and values: YAML's flow mapping or its lines, strings plain or quoted, and a block scalar
 * (`key: |` or `key: >` with the lines under it). A nested value is kept as written.
 */
function readMetadata(body: string, line: number): Map<string, string> {
  const out = new Map<string, string>();
  let i = 0;
  const skip = (): void => {
    while (i < body.length && /[\s,]/.test(body[i]!)) i++;
  };
  while (true) {
    skip();
    if (i >= body.length) return out;
    const key = at(/([A-Za-z_][\w-]*)\s*:/y, body, i);
    if (!key) throw new Refusal(`metadata it cannot read: ${clipText(body.slice(i))}`, line);
    i += key[0].length;
    while (body[i] === " " || body[i] === "\t") i++;
    let value: string;
    const block = at(/([|>])[+-]?[ \t]*\n/y, body, i);
    if (block) {
      // The lines more indented than the key's, kept (|) or folded into one (>).
      const keyIndent = body.lastIndexOf("\n", i - key[0].length) + 1;
      const own = /^[ \t]*/.exec(body.slice(keyIndent))![0].length;
      i += block[0].length;
      const kept: string[] = [];
      let indent = -1;
      while (i < body.length) {
        const end = body.indexOf("\n", i) < 0 ? body.length : body.indexOf("\n", i);
        const row = body.slice(i, end);
        const lead = /^[ \t]*/.exec(row)![0].length;
        if (row.trim() !== "" && lead <= own) break;
        if (row.trim() !== "" && indent < 0) indent = lead;
        kept.push(row.slice(Math.min(lead, Math.max(indent, 0))));
        i = end + 1;
      }
      while (kept.length > 0 && kept[kept.length - 1]!.trim() === "") kept.pop();
      value = block[1] === "|" ? kept.join("\n") : kept.join(" ").replace(/\s+/g, " ").trim();
    } else if (body[i] === '"') {
      const quoted = doubleQuoted(body, i);
      value = quoted.value;
      i = quoted.end;
    } else if (body[i] === "'") {
      let v = "";
      let j = i + 1;
      for (; j < body.length; j++) {
        if (body[j] === "'" && body[j + 1] === "'") {
          v += "'";
          j++;
        } else if (body[j] === "'") break;
        else v += body[j];
      }
      value = v;
      i = j + 1;
    } else if (body[i] === "{" || body[i] === "[") {
      // A nested value: kept as written, up to its matching bracket.
      const start = i;
      let depth = 0;
      for (; i < body.length; i++) {
        if (body[i] === '"') i = pastQuote(body, i, true) - 1;
        else if (body[i] === "{" || body[i] === "[") depth++;
        else if (body[i] === "}" || body[i] === "]") {
          depth--;
          if (depth === 0) {
            i++;
            break;
          }
        }
      }
      value = body.slice(start, i);
    } else {
      const m = at(/[^,\n]*/y, body, i)!;
      value = m[0].trim();
      i += m[0].length;
    }
    // Prototype-shaped keys are dropped, as Mermaid drops them.
    if (!["__proto__", "constructor", "prototype"].includes(key[1]!)) out.set(key[1]!, value);
  }
}

/** The `{ … }` of a `@{ … }` that opens at `open`: the whole block, which may run over several lines already joined. */
function readMetaBlock(s: string, open: number, line: number): { meta: Map<string, string>; end: number } {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    if (s[i] === '"') i = pastQuote(s, i, true) - 1;
    else if (s[i] === "{") depth++;
    else if (s[i] === "}") {
      depth--;
      if (depth === 0) return { meta: readMetadata(s.slice(open + 1, i), line), end: i + 1 };
    }
  }
  throw new Refusal(`a @{ block that does not close`, line);
}

type Arrow = { label?: string; dotted: boolean; head: RawEdge["head"]; reference: boolean; invisible: boolean; end: number };

/** An arrow with its label after it, or no label: `-->`, `---`, `-.->`, `==>`, `--x`, `--o`, `~~~`, each as long as wanted. */
const PLAIN = /[<xo]?((?:-{2,}|={2,})>|(?:-{2,}|={2,})[xo]|-{3,}|={3,}|-\.+-(?:>|[xo])?|~{3,})/y;
/** Where an arrow with its label in the middle opens: `--`, `==`, `-.`. */
const OPENING = /[<xo]?(--|==|-\.)/y;
/** Where it closes. It is tried only where a run of its characters starts, so each run is read once. */
const CLOSING = /(-{2,}>|-{3,}|\.-+>|\.-+|={2,}>|={3,}|-{2,}[xo]|={2,}[xo])(?=[\s\p{L}\p{N}_"]|$)/uy;

/** An edge's arrow at `from`, with its label in either place Mermaid allows one. */
function readArrow(s: string, from: number, kind: Reading["kind"], edgeIds: Set<string>): Arrow | undefined {
  // An edge's own id (`e1@-->`) is read and left out.
  const named = at(/([\p{L}\p{N}_]+)@(?=[-=.<xo~])/uy, s, from);
  if (named) edgeIds.add(named[1]!);
  const start = from + (named ? named[0].length : 0);
  const make = (body: string, opener: string, label: string | undefined, end: number): Arrow => ({
    ...(label !== undefined ? { label } : {}),
    dotted: body.includes(".") || opener === "-.",
    head: body.endsWith(">") ? ">" : body.endsWith("x") ? "x" : body.endsWith("o") ? "o" : "",
    reference: kind === "agentflow" && (body.includes(".") || opener === "-.") && !body.endsWith(">"),
    invisible: body.startsWith("~"),
    end,
  });
  const plain = at(PLAIN, s, start);
  if (plain) {
    let end = start + plain[0].length;
    const pipe = at(/\s*\|("[^"]*"|[^|]*)\|/y, s, end);
    if (pipe) end += pipe[0].length;
    return make(plain[1]!, "", pipe?.[1], end);
  }
  // The label in the middle: `-- text -->`, `-. text .->`, `== text ==>`, found by trying the close at each place.
  const opening = at(OPENING, s, start);
  if (!opening) return undefined;
  let i = start + opening[0].length;
  while (s[i] === " " || s[i] === "\t") i++;
  const labelFrom = i;
  if (s[i] === '"') i = pastQuote(s, i);
  for (const last = Math.min(s.length, labelFrom + READ_LIMITS.middleLabel); i < last; i++) {
    if (s[i] === "\n") break;
    if (s[i] === s[i - 1]) continue; // inside a run that was tried where it started
    const closing = at(CLOSING, s, i);
    if (closing && s.slice(labelFrom, i).trim() !== "") return make(closing[1]!, opening[1]!, s.slice(labelFrom, i).trim(), i + closing[0].length);
  }
  return undefined;
}

const clipText = (s: string): string => (s.length > 40 ? `${s.slice(0, 39)}…` : s);

/** Split a line into statements at `;` outside quotes, brackets, metadata and an edge's label. */
function statements(line: string): string[] {
  const out: string[] = [];
  let start = 0;
  walk(line, (c, i, depth) => {
    if (c === ";" && depth === 0) {
      out.push(line.slice(start, i));
      start = i + 1;
    }
  });
  out.push(line.slice(start));
  return out.map((s) => s.trim()).filter((s) => s !== "");
}

/** The first line of a diagram: its type and, for these three, a direction, and nothing else but a `;`. */
const HEADER = /^(flowchart|graph|agentflow-beta)(?:\s+(TB|TD|BT|LR|RL))?\s*$/;

function read(source: string): Reading {
  if (source.length > READ_LIMITS.text) throw new Refusal(`text of ${source.length.toLocaleString("en")} characters: grooph reads Mermaid of up to ${READ_LIMITS.text.toLocaleString("en")}`);
  // Text that holds a ```mermaid block, such as a Markdown note, is read from its first one.
  const fence = /^(`{3,}|~{3,})[ \t]*mermaid[^\n]*\n([\s\S]*?)^\1[ \t]*$/m.exec(source.replace(/\r\n?/g, "\n"));
  const lines = (fence ? fence[2]! : source).replace(/\r\n?/g, "\n").split("\n");
  let i = 0;
  // Front matter (`---` … `---`) holds configuration and a title; the title is kept as a comment.
  const comments: string[] = [];
  while (i < lines.length && lines[i]!.trim() === "") i++;
  if (lines[i]?.trim() === "---") {
    const close = lines.findIndex((l, n) => n > i && l.trim() === "---");
    if (close < 0) throw new Refusal("front matter that does not close", i + 1);
    for (const l of lines.slice(i + 1, close)) {
      const title = /^title:\s*(.+)$/.exec(l.trim());
      if (title) comments.push(`title: ${text(title[1]!.replace(/^['"]|['"]$/g, ""))}`);
    }
    i = close + 1;
  }
  let kind: Reading["kind"] | undefined;
  const reading: Reading = { kind: "flowchart", nodes: new Map(), containers: [], edges: [], comments, skipped: new Map(), edgeIds: new Set(), classes: new Map() };
  const stack: number[] = [];
  const touch = (id: string, line: number): RawNode => {
    let node = reading.nodes.get(id);
    if (!node) {
      if (reading.nodes.size >= READ_LIMITS.nodes) throw new Refusal(`more than ${READ_LIMITS.nodes.toLocaleString("en")} nodes, far more than grooph opens`, line);
      const inGlobal = stack.some((c) => reading.containers[c]!.kind === "global");
      const parent = inGlobal ? undefined : [...stack].reverse().find((c) => reading.containers[c]!.kind !== "global");
      node = { id, classes: [], meta: new Map(), line, ...(parent !== undefined ? { parent } : {}) };
      reading.nodes.set(id, node);
    }
    return node;
  };
  const skip = (word: string): void => void reading.skipped.set(word, (reading.skipped.get(word) ?? 0) + 1);

  for (; i < lines.length; i++) {
    let raw = lines[i]!;
    const lineNo = i + 1;
    const trimmed = raw.trim();
    if (trimmed === "") continue;
    if (trimmed.startsWith("%%")) {
      comments.push(trimmed.replace(/^%%\s?/, ""));
      continue;
    }
    // An accessible description over several lines (`accDescr { … }`) is read and left out.
    if (/^accDescr\s*\{/.test(trimmed) && !trimmed.includes("}")) {
      while (i + 1 < lines.length && !lines[i]!.includes("}")) i++;
      continue;
    }
    // A metadata block over several lines, and a quoted label over several, are joined into one, to a point.
    for (let joined = 1; i + 1 < lines.length && walk(raw); joined++) {
      if (joined >= READ_LIMITS.statementLines) throw new Refusal(`a quote or a @{ block that does not close within ${READ_LIMITS.statementLines} lines`, lineNo);
      raw += `\n${lines[++i]!}`;
    }
    const parts = statements(raw);
    if (kind === undefined) {
      // The header, and on the same line after a `;`, the diagram's first statements.
      const head = HEADER.exec(parts[0] ?? "");
      if (!head) {
        const met = /^[^\s;{]+/.exec(trimmed)?.[0] ?? trimmed;
        throw new Refusal(`this is not a diagram grooph reads: it starts with "${clipText(met)}". grooph reads ${MERMAID_SUBSET}`, lineNo);
      }
      kind = head[1] === "agentflow-beta" ? "agentflow" : "flowchart";
      reading.kind = kind;
      parts.shift();
    }
    for (const statement of parts) readStatement(statement, lineNo);
  }
  if (kind === undefined) throw new Refusal(`no diagram: the text is empty or only comments. grooph reads ${MERMAID_SUBSET}`);
  return reading;

  function readStatement(s: string, lineNo: number): void {
    const word = /^[A-Za-z-]+/.exec(s)?.[0] ?? "";
    if (word === "end" && s === "end") {
      if (stack.length === 0) throw new Refusal(`an "end" with nothing open`, lineNo);
      stack.pop();
      return;
    }
    if (word === "direction" && /^direction\s+(TB|TD|BT|LR|RL)$/.test(s)) return;
    const styling = ["classDef", "class", "style", "linkStyle", "click"].includes(word) && /^[A-Za-z]+\s/.test(s);
    const described = ["accTitle", "accDescr"].includes(word) && /^[A-Za-z]+\s*[:{]/.test(s);
    if (styling || described) {
      if (word === "class") {
        // `class a,b name` gives classes, and makes no node: the stops note is found by its class.
        const m = /^class\s+([^\s]+)\s+([\w-]+)/.exec(s);
        if (m) for (const id of m[1]!.split(",")) reading.classes.set(id.trim(), [...(reading.classes.get(id.trim()) ?? []), m[2]!]);
      } else skip(word);
      return;
    }
    // A box opens with its keyword and a name; the keyword alone, or before an arrow, is a node's id.
    const boxed = /^(subgraph|flow)\s+(?![-=.~<]{2})/.exec(s);
    if (boxed && (boxed[1] === "subgraph" ? reading.kind === "flowchart" : reading.kind === "agentflow")) return open(boxed[1] as "subgraph" | "flow", s.slice(boxed[0].length).trim(), lineNo);
    if (word === "global" && reading.kind === "agentflow" && s === "global") {
      reading.containers.push({ id: "", label: "", kind: "global", line: lineNo, ...(stack.length ? { parent: stack[stack.length - 1]! } : {}) });
      stack.push(reading.containers.length - 1);
      return;
    }
    if (word === "connector" && reading.kind === "agentflow" && /^connector\s/.test(s)) {
      skip("connector");
      return;
    }
    // An edge's own metadata (`e1@{ animate: true }`) is presentation, and left out.
    const edgeMeta = /^([\p{L}\p{N}_]+)@\{/u.exec(s);
    if (edgeMeta && reading.edgeIds.has(edgeMeta[1]!)) return;
    chain(s, lineNo);
  }

  function open(kindOf: "subgraph" | "flow", rest: string, lineNo: number): void {
    if (reading.containers.length >= READ_LIMITS.boxes) throw new Refusal(`more than ${READ_LIMITS.boxes.toLocaleString("en")} subgraphs and flows, far more than grooph opens`, lineNo);
    if (stack.length >= READ_LIMITS.depth) throw new Refusal(`subgraphs or flows nested more than ${READ_LIMITS.depth} deep`, lineNo);
    // `subgraph id[label]`, `subgraph id ["label"]`, `subgraph "label"`, `subgraph some words`; a flow takes the
    // first two, and may carry its metadata after its name or its label: `flow f["F"]@{ model: … }`.
    const id = at(ID, rest, 0);
    let label = "";
    let name = "";
    let meta: Map<string, string> | undefined;
    if (id) {
      name = id[0];
      let after = rest.slice(id[0].length).trim();
      if (after.startsWith("[")) {
        const b = readBracket(after, 0, lineNo);
        if (b) {
          label = text(b.label);
          after = after.slice(b.end).trim();
        }
      }
      if (after.startsWith("@{")) {
        const block = readMetaBlock(after, 1, lineNo);
        meta = block.meta;
        after = after.slice(block.end).trim();
      }
      if (after !== "") {
        if (kindOf === "flow") throw new Refusal(`a flow it cannot read: ${clipText(rest)}`, lineNo);
        name = rest;
        label = text(rest);
      }
    } else if (rest.startsWith('"')) {
      label = text(rest);
      name = label;
    } else throw new Refusal(`a ${kindOf} with no name`, lineNo);
    if (meta) for (const [k, v] of meta) touch(name, lineNo).meta.set(k, v);
    reading.containers.push({ id: name, label: label || name, kind: kindOf, line: lineNo, ...(stack.length ? { parent: stack[stack.length - 1]! } : {}) });
    stack.push(reading.containers.length - 1);
  }

  function chain(s: string, lineNo: number): void {
    let from = 0;
    let previous: string[] | undefined;
    let arrow: Arrow | undefined;
    while (true) {
      while (s[from] === " " || s[from] === "\t") from++;
      // A group of nodes joined by `&`.
      const group: string[] = [];
      while (true) {
        const id = at(ID, s, from);
        if (!id) throw new Refusal(`something it cannot read: ${clipText(s.slice(from)) || clipText(s)}`, lineNo);
        const node = touch(id[0], lineNo);
        from += id[0].length;
        const bracket = readBracket(s, from, lineNo);
        if (bracket) {
          node.shape = bracket.shape;
          node.label = text(bracket.label);
          from = bracket.end;
        }
        if (s.startsWith("@{", from)) {
          const block = readMetaBlock(s, from + 1, lineNo);
          for (const [k, v] of block.meta) node.meta.set(k, v);
          from = block.end;
        }
        const cls = at(/:::([\w-]+)/y, s, from);
        if (cls) {
          node.classes.push(cls[1]!);
          from += cls[0].length;
        }
        group.push(node.id);
        const amp = at(/\s*&\s*/y, s, from);
        if (!amp) break;
        from += amp[0].length;
      }
      if (previous && arrow) {
        if (reading.edges.length + previous.length * group.length > READ_LIMITS.edges) throw new Refusal(`more than ${READ_LIMITS.edges.toLocaleString("en")} edges, far more than grooph opens`, lineNo);
        for (const a of previous) for (const b of group) reading.edges.push({ from: a, to: b, ...(arrow.label !== undefined ? { label: arrow.label } : {}), dotted: arrow.dotted, head: arrow.head, reference: arrow.reference, invisible: arrow.invisible, line: lineNo });
      }
      while (s[from] === " " || s[from] === "\t") from++;
      if (from >= s.length) return;
      arrow = readArrow(s, from, reading.kind, reading.edgeIds);
      if (!arrow) throw new Refusal(`something it cannot read after "${clipText(group.join(" & "))}": ${clipText(s.slice(from))}`, lineNo);
      from = arrow.end;
      previous = group;
    }
  }
}

// ─── turning it into a graph document ─────────────────────────────────────

/** A Mermaid id as a grooph id: kebab-case, starting with a letter. */
function kebab(raw: string): string {
  const id = raw
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return /^[a-z]/.test(id) ? id : `n-${id || "node"}`;
}

/** The six stop kinds, read back from the words `describeStop` writes. */
export function readStop(line: string): Stop | undefined {
  const arrow = / → ([a-z][a-z0-9-]*)$/.exec(line);
  const then = arrow ? { then: arrow[1]! } : {};
  const t = arrow ? line.slice(0, arrow.index) : line;
  let m: RegExpExecArray | null;
  if (t === "bar passed") return { kind: "bar-passed", ...then };
  if (t === "human halt") return { kind: "human", ...then };
  if ((m = /^human halt, asked every ([1-9]\d*) round\(s\)$/.exec(t))) return { kind: "human", every: Number(m[1]), ...then };
  if ((m = /^max iterations: ([1-9]\d*)$/.exec(t))) return { kind: "max-iterations", n: Number(m[1]), ...then };
  if ((m = /^budget: (\d+(?:\.\d+)?) (dispatches|minutes|usd|turns|tokens)$/.exec(t))) return { kind: "budget", measure: m[2] as BudgetMeasure, limit: Number(m[1]), ...then };
  if ((m = /^evidence invalid for ([1-9]\d*) round\(s\)$/.exec(t))) return { kind: "evidence-invalid", rounds: Number(m[1]), ...then };
  if ((m = /^diminishing returns over ([1-9]\d*) round\(s\)(?: on (.+?))?(?: \(threshold (-?\d+(?:\.\d+)?)\))?$/.exec(t))) {
    return { kind: "diminishing-returns", rounds: Number(m[1]), ...(m[2] !== undefined ? { metric: m[2] } : {}), ...(m[3] !== undefined ? { threshold: Number(m[3]) } : {}), ...then };
  }
  return undefined;
}

const ROLES: readonly Role[] = ["lead", "planner", "builder", "critic", "tester", "researcher", "red-team", "judge", "synthesizer"];
const TIERS = ["frontier", "strong", "fast"] as const;
const CHECK_KINDS = ["command", "tests", "diff", "metric", "evidence"] as const;

/**
 * What the reader finds in Mermaid text before it makes a document of it: the diagram type, the nodes and the
 * edges by their Mermaid ids, and the boxes (subgraphs and flows). For comparing with another reader.
 */
export function readMermaidSyntax(source: string):
  | { ok: true; kind: "flowchart" | "agentflow"; nodes: string[]; edges: { from: string; to: string; label?: string }[]; boxes: string[] }
  | { ok: false; error: string; line?: number } {
  try {
    const r = read(source);
    const boxes = r.containers.filter((c) => c.kind !== "global").map((c) => c.id);
    const nodes = [...r.nodes.keys()].filter((id) => !boxes.includes(id) && !r.edgeIds.has(id));
    return { ok: true, kind: r.kind, nodes, edges: r.edges.map((e) => ({ from: e.from, to: e.to, ...(e.label !== undefined ? { label: text(e.label) } : {}) })), boxes };
  } catch (err) {
    if (err instanceof Refusal) return { ok: false, error: err.message, ...(err.line !== undefined ? { line: err.line } : {}) };
    throw err;
  }
}

/**
 * Whether text means to be Mermaid: it holds a ```mermaid block, or its first line that is not a comment or front
 * matter names a kind of Mermaid diagram. Whether grooph reads it is `readMermaid`'s to say.
 */
export function isMermaidText(source: string): boolean {
  const text = source.replace(/\r\n?/g, "\n");
  if (/^(`{3,}|~{3,})[ \t]*mermaid\b/m.test(text)) return true;
  const body = text.trimStart().startsWith("---") ? text.trimStart().replace(/^---\n[\s\S]*?\n---[ \t]*(\n|$)/, "") : text;
  const first = body.split("\n").map((line) => line.trim()).find((line) => line !== "" && !line.startsWith("%%"));
  if (first === undefined) return false;
  // A header is the type alone, or with a direction, or before a `;`: "graph of costs per month" is a sentence.
  if (/^(flowchart|graph|agentflow-beta)(\s+(TB|TD|BT|LR|RL))?\s*(;.*)?$/.test(first)) return true;
  return /^(sequenceDiagram|classDiagram(-v2)?|stateDiagram(-v2)?|erDiagram|journey|gantt|pie(\s+(title|showData)\b.*)?|quadrantChart|requirementDiagram|gitGraph(\s+(TB|BT|LR))?:?|C4Context|C4Container|C4Component|C4Dynamic|C4Deployment|mindmap|timeline(\s+(TB|TD|BT|LR|RL))?|zenuml|sankey(-beta)?|xychart(-beta)?(\s+horizontal)?|block(-beta)?|packet(-beta)?|kanban|architecture(-beta)?|radar(-beta)?|treemap(-beta)?|venn(-beta)?|ishikawa(-beta)?|railroad(-[a-z]+)?(-beta)?|usecase(-beta)?|swimlane(-beta)?(\s+(TB|TD|BT|LR|RL))?|cynefin(-beta)?|wardley(-beta)?|eventmodeling(-beta)?|treeView(-beta)?|info(\s+showInfo)?)\s*$/.test(first);
}

/** Read Mermaid text into a graph document. Never throws: a refusal comes back as `ok: false`. */
export function readMermaid(source: string, options: MermaidReadOptions = {}): MermaidRead {
  try {
    const reading = read(source);
    // grooph's size caps (limits.ts), on what the text holds before a document is made of it.
    const over = overLimit({ nodes: [...reading.nodes.keys()], edges: reading.edges }, "graph");
    if (over) throw new Refusal(`a diagram too large to open: ${over.message}`);
    const made = build(reading, options);
    // What the reader makes is held to the document's schema like any other document, so it is never handed on half right.
    const checked = parseGraph(made.doc);
    if (!checked.doc) throw new Refusal(`a diagram that does not make a valid document: ${checked.issues[0]?.message ?? "it does not match the schema"}`);
    return made;
  } catch (err) {
    if (err instanceof Refusal) return { ok: false, error: err.message, ...(err.line !== undefined ? { line: err.line } : {}) };
    // A reader that ran out of room says so, rather than throw: the text is someone else's.
    if (err instanceof RangeError) return { ok: false, error: "a diagram nested or chained too deeply to read" };
    throw err;
  }
}

function build(r: Reading, options: MermaidReadOptions): { ok: true; doc: Graph; guesses: string[] } {
  const guesses: string[] = [];
  const header = r.comments.map((c) => /^grooph mermaid(?: --agentflow)?: (?:a projection of )?(.+) \(([a-z][a-z0-9-]*)@(\d+)\)/.exec(c)).find((m) => m !== null) ?? undefined;
  // grooph's own text prefixes its ids (`n_` a node or a loop, `t_` an agent's task, `stops_` a loop's note); read back, they come off.
  const ours = header !== undefined;
  const own = (raw: string): string => kebab(ours ? raw.replace(/^n_/, "") : raw);
  const title = r.comments.find((c) => c.startsWith("title: "))?.slice("title: ".length);
  // The header writes the name as a label is written; it is read back the same way.
  const name = (header ? entities(header[1]!) : undefined) ?? title ?? options.name ?? "Imported diagram";
  const graphId = header?.[2] ?? kebab(name);
  if (!header && !title && options.name === undefined) guesses.push(`The graph's name: "${name}"`);

  const ids = new Set<string>([graphId]);
  // A box's own id is kept for it: an edge or a node takes another, so a loop named like an edge keeps its id.
  const kept = new Set(r.containers.filter((c) => c.kind === "subgraph").map((c) => own(c.id)));
  // The next number to try for each base, so a thousand edges between the same two nodes do not count up from 2 each time.
  const next = new Map<string, number>();
  const unique = (base: string, box = false): string => {
    let id = base;
    for (let k = next.get(base) ?? 2; ids.has(id) || (!box && kept.has(id)); k++) {
      id = `${base}-${k}`;
      next.set(base, k + 1);
    }
    ids.add(id);
    return id;
  };

  const boxIds = new Set(r.containers.filter((c) => c.kind !== "global").map((c) => c.id));
  /** A raw node that only names a box: an edge to a subgraph, or a flow's own metadata line. */
  const isBox = (n: RawNode): boolean => boxIds.has(n.id) && n.shape === undefined && n.label === undefined && !n.meta.has("shape") && !n.meta.has("label");
  /** grooph's note of a loop's stops: by its class, or by its id in the earlier form. */
  const isNote = (n: RawNode): boolean => ours && (n.classes.includes("stop") || (r.classes.get(n.id) ?? []).includes("stop") || n.id.startsWith("stops_"));
  // In an agentflow a flow that holds no flow is an agent, and everything inside it is that agent's; a flow of flows is a team.
  const teams = new Set(r.containers.flatMap((c) => (c.kind === "flow" && c.parent !== undefined && r.containers[c.parent]!.kind === "flow" ? [c.parent] : [])));
  const agentFlowOf = (n: RawNode): number | undefined => {
    for (let c = n.parent; c !== undefined; c = r.containers[c]!.parent) if (r.containers[c]!.kind === "flow") return teams.has(c) ? undefined : c;
    return undefined;
  };

  /** Reference material in an agentflow: what an agent consults, not a step. */
  const isReference = (n: RawNode): boolean => r.kind === "agentflow" && ["refdoc", "lin-doc", "doc", "docs"].includes(n.meta.get("shape") ?? "");

  const nodes: Node[] = [];
  /** raw id (a node, a flow, an agent's task) → the grooph node it became; "" for what was left out on purpose */
  const at = new Map<string, Id>();
  let goal: string | undefined;

  /** An agent from what the text says of it; what it does not say is filled in and said. */
  const agent = (id: Id, label: string, meta: Map<string, string>, fill: { brief?: string; role?: Role; person?: boolean; why?: string }): AgentNode => {
    const person = fill.person === true || / \(a person\)$/.test(label);
    const named = label.replace(/ \(a person\)$/, "");
    const role = meta.get("role");
    const tier = meta.get("model");
    const brief = meta.get("instruction") ?? fill.brief ?? "";
    const node: AgentNode = {
      id,
      kind: "agent",
      name: named,
      ...(person ? { by: "person" as const } : {}),
      role: role === undefined ? (fill.role ?? "builder") : (ROLES as readonly string[]).includes(role) ? (role as Role) : { custom: role },
      ...(tier !== undefined && (TIERS as readonly string[]).includes(tier) ? { model: { tier: tier as (typeof TIERS)[number] } } : {}),
      brief,
      outputs: ["its work"],
    };
    const said: string[] = [];
    if (role === undefined) said.push(`${fill.why ? `${fill.why}, so ` : ""}${person ? "a person's step" : "an agent"} with the ${typeof node.role === "string" ? node.role : node.role.custom} role`);
    if (tier !== undefined && !node.model) said.push(`the model "${tier}" is not a tier grooph knows (frontier, strong, fast), so it was left out`);
    said.push(`${brief === "" ? "its brief and " : ""}its outputs are left to fill in`);
    guesses.push(`${named}: ${said.join("; ")}`);
    return node;
  };
  const check = (id: Id, label: string, meta: Map<string, string>, why: string): Node => {
    const kind = meta.get("check");
    const pass = meta.get("pass");
    const run = meta.get("run");
    if (pass === undefined) guesses.push(`${label}: ${why}, so a check that passes when "${label}" holds`);
    const known = kind !== undefined && (CHECK_KINDS as readonly string[]).includes(kind);
    return { id, kind: "check", name: label, check: { kind: known ? (kind as (typeof CHECK_KINDS)[number]) : "command", ...(run !== undefined ? { run } : {}), pass: pass ?? label } };
  };
  const gate = (id: Id, label: string, meta: Map<string, string>, why: string): Node => {
    // grooph writes a gate's question as `question`; `prompt` is read too.
    const prompt = meta.get("question") ?? meta.get("prompt");
    if (prompt === undefined) guesses.push(`${label}: ${why}, so a human gate asking "Approve: ${label}?"`);
    return { id, kind: "human-gate", name: label, prompt: prompt ?? `Approve: ${label}?` };
  };

  if (r.kind === "agentflow") {
    r.containers.forEach((c, index) => {
      if (c.kind !== "flow" || teams.has(index)) return;
      const inside = [...r.nodes.values()].filter((n) => !isBox(n) && !isReference(n) && !r.edgeIds.has(n.id) && agentFlowOf(n) === index);
      const id = unique(own(c.id));
      const first = inside[0];
      nodes.push(agent(id, c.label, r.nodes.get(c.id)?.meta ?? new Map(), { ...(first?.label ? { brief: first.label.replace(/\n/g, " ") } : {}), why: "a flow" }));
      at.set(c.id, id);
      for (const n of inside) at.set(n.id, id);
      if (inside.length > 1) guesses.push(`${c.label}: its ${inside.length} steps are one agent`);
    });
  }

  for (const n of r.nodes.values()) {
    if (at.has(n.id) || isNote(n) || isBox(n) || r.edgeIds.has(n.id)) continue;
    const label = (n.label ?? n.meta.get("label") ?? n.id).replace(/\n/g, " ");
    if (r.kind === "agentflow") {
      const shape = n.meta.get("shape") ?? "task";
      if (["input", "lean-r", "lean-right", "in-out"].includes(shape) && goal === undefined) {
        goal = n.meta.get("value") ?? label;
        at.set(n.id, "");
        if (!ours) guesses.push(`${label}: an input, so the graph's goal`);
        continue;
      }
      if (isReference(n)) {
        guesses.push(`${label}: reference material, not a step, so it was left out`);
        at.set(n.id, "");
        continue;
      }
      const id = unique(own(n.id));
      at.set(n.id, id);
      const kind = n.meta.get("kind");
      if (["action", "hexagon", "hex"].includes(shape)) {
        if (n.meta.has("question") || n.meta.has("prompt")) nodes.push(gate(id, label, n.meta, "an action"));
        else nodes.push(agent(id, label, n.meta, { person: true, why: "an action" }));
      } else if (["decision", "diamond", "diam"].includes(shape)) nodes.push(check(id, label, n.meta, "a decision"));
      else if (kind === "merge") nodes.push({ id, kind: "merge", name: label, merges: [] });
      else if (kind === "stop") nodes.push({ id, kind: "stop", name: label });
      else nodes.push(agent(id, label, n.meta, { why: `a ${shape}` }));
      continue;
    }
    const id = unique(own(n.id));
    at.set(n.id, id);
    const named = n.meta.get("shape");
    const shape = n.shape ?? flowchartShape(named);
    if (shape === "diamond") nodes.push(agent(id, label, n.meta, { role: "critic", why: "a diamond" }));
    else if (shape === "hexagon") nodes.push(check(id, label, n.meta, "a hexagon"));
    else if (shape === "trapezoid") nodes.push(gate(id, label, n.meta, "a trapezoid"));
    else if (shape === "circle") nodes.push({ id, kind: "merge", name: label, merges: [] });
    else if (shape === "double-circle") nodes.push({ id, kind: "stop", name: label });
    // grooph's export draws a writer as a box and any other role as a stadium.
    else nodes.push(agent(id, label, n.meta, shape === "stadium" ? { role: "researcher", why: "a stadium" } : { why: shapeWords(n.shape ?? named ?? shape) }));
  }

  const edges: Edge[] = [];
  const dotted = new Set<Id>();
  const carried = new Map<Id, Stop[]>();
  const seen = new Set<string>();
  let references = 0;
  let crosses = 0;
  let invisible = 0;
  let merged = 0;
  const toBoxes = new Set<string>();
  for (const e of r.edges) {
    if (e.reference) {
      references++;
      continue;
    }
    if (e.invisible) {
      invisible++;
      continue;
    }
    const from = at.get(e.from);
    const to = at.get(e.to);
    if (from === undefined || to === undefined) {
      for (const end of [e.from, e.to]) if (boxIds.has(end) && !at.has(end)) toBoxes.add(end);
      continue;
    }
    if (from === "" || to === "") continue; // the goal and reference material are not steps
    if (from === to && e.from !== e.to) continue; // two steps inside one agent's flow
    const lines = e.label === undefined ? [] : text(e.label).split("\n");
    const stopAt = lines.findIndex((l) => l.startsWith("stops: "));
    const said = (stopAt < 0 ? lines : lines.slice(0, stopAt)).join(" ");
    const stops = stopAt < 0 ? [] : [lines[stopAt]!.slice("stops: ".length), ...lines.slice(stopAt + 1)].map(readStop);
    const { when, approval, label } = condition(said, e.head === "x");
    if (e.head === "x" && said === "") crosses++;
    const key = `${from}>${to}>${JSON.stringify(when)}>${approval}>${label ?? ""}`;
    if (seen.has(key)) {
      merged++;
      continue;
    }
    seen.add(key);
    const id = unique(`${from}-to-${to}`);
    edges.push({ id, from, to, ...(when !== "always" ? { when } : {}), ...(approval ? { approval: true } : {}), ...(label !== undefined ? { label } : {}) });
    if (e.dotted) dotted.add(id);
    if (stops.length > 0) {
      const read = stops.filter((s): s is Stop => s !== undefined);
      carried.set(id, read);
      if (read.length < stops.length) guesses.push(`${from} → ${to}: ${stops.length - read.length} stop(s) it could not read were left out`);
    }
  }
  if (invisible > 0) guesses.push(`${invisible} invisible link${invisible === 1 ? "" : "s"} (~~~) left out: they only place nodes`);
  if (crosses > 0) guesses.push(`${crosses} edge${crosses === 1 ? "" : "s"} with a cross at its head (--x), so on fail`);
  if (merged > 0) guesses.push(`${merged} edge${merged === 1 ? "" : "s"} said twice, kept once`);
  if (references > 0) guesses.push(`${references} reference line${references === 1 ? "" : "s"} (-.-) left out: a reference is not a step`);
  for (const box of toBoxes) guesses.push(`An edge to the box "${box}" was left out: an edge in grooph joins two steps`);

  const { loops, groups } = boxesAndLoops(r, nodes, edges, dotted, carried, at, ours, own, unique, guesses);
  if (!ours) {
    for (const [word, count] of r.skipped) {
      guesses.push(`${count} ${word} line${count === 1 ? "" : "s"} left out: grooph draws in its own style`);
    }
  }
  const doc: Graph = {
    grooph: 0,
    id: graphId,
    name,
    version: header ? Number(header[3]) : 1,
    ...(goal !== undefined ? { goal } : {}),
    nodes,
    edges,
    loops,
    ...(groups.length > 0 ? { groups } : {}),
  };
  return { ok: true, doc, guesses };
}

/** What a shape is called where a guess names it: Mermaid's names for the less common shapes are not words. */
const SHAPE_WORDS: Record<string, string> = {
  rect: "a box",
  rectangle: "a box",
  proc: "a box",
  process: "a box",
  plain: "a box",
  event: "a rounded box",
  round: "a rounded box",
  rounded: "a rounded box",
  subroutine: "a box with double sides",
  "fr-rect": "a box with double sides",
  "framed-rectangle": "a box with double sides",
  subproc: "a box with double sides",
  subprocess: "a box with double sides",
  cylinder: "a cylinder",
  cyl: "a cylinder",
  database: "a cylinder",
  db: "a cylinder",
  doc: "a document shape",
  document: "a document shape",
  asymmetric: "a flag",
  "inv-trapezoid": "a trapezoid wide at the top",
  "trap-t": "a trapezoid wide at the top",
  "lean-right": "a parallelogram",
  "lean-r": "a parallelogram",
  "lean-left": "a parallelogram",
  "lean-l": "a parallelogram",
  tri: "a triangle",
  triangle: "a triangle",
  extract: "a triangle",
  "flip-tri": "an upside-down triangle",
  "flipped-triangle": "an upside-down triangle",
  "manual-file": "an upside-down triangle",
  "sm-circ": "a small circle",
  "small-circle": "a small circle",
  start: "a small circle",
  "f-circ": "a small filled circle",
  "filled-circle": "a small filled circle",
  junction: "a small filled circle",
};
const shapeWords = (shape: string): string => SHAPE_WORDS[shape] ?? `a shape Mermaid calls "${shape}"`;

function flowchartShape(named: string | undefined): Shape {
  switch (named) {
    case "diam": case "diamond": case "decision": case "question": return "diamond";
    case "hex": case "hexagon": case "prepare": return "hexagon";
    case "trap-b": case "trapezoid": case "priority": case "manual": return "trapezoid";
    case "circle": case "circ": return "circle";
    case "dbl-circ": case "double-circle": case "fr-circ": case "stop": return "double-circle";
    case "stadium": case "terminal": case "pill": return "stadium";
    default: return "rect";
  }
}

/** An edge label's words as a condition: pass, fail, `verdict: x`, and approval; any other words stay a label. */
function condition(said: string, failure: boolean): { when: EdgeWhen; approval: boolean; label?: string } {
  // grooph writes the condition, then ", approval" when the edge needs one; a verdict's own words may hold commas.
  const trimmed = said.trim();
  const approval = trimmed === "approval" || trimmed.endsWith(", approval");
  const rest = approval ? trimmed.slice(0, Math.max(0, trimmed.length - "approval".length)).replace(/,\s*$/, "").trim() : trimmed;
  if (rest === "") return { when: failure ? "fail" : "always", approval };
  if (rest === "pass" || rest === "fail" || rest === "always") return { when: rest, approval };
  const verdict = /^verdict: (.+)$/.exec(rest);
  if (verdict) return { when: { verdict: verdict[1]! }, approval };
  return { when: failure ? "fail" : "always", approval: false, label: trimmed };
}

/** Strongly connected parts of the edges, in node order. */
function components(nodes: Node[], edges: Edge[]): Id[][] {
  const out = new Map<Id, Id[]>();
  for (const e of edges) (out.get(e.from) ?? out.set(e.from, []).get(e.from)!).push(e.to);
  let index = 0;
  const idx = new Map<Id, number>();
  const low = new Map<Id, number>();
  const on = new Set<Id>();
  const stack: Id[] = [];
  const result: Id[][] = [];
  // Iterative Tarjan, so a long chain cannot overflow the call stack.
  for (const start of nodes.map((n) => n.id)) {
    if (idx.has(start)) continue;
    const work: { v: Id; i: number }[] = [{ v: start, i: 0 }];
    idx.set(start, index);
    low.set(start, index++);
    stack.push(start);
    on.add(start);
    while (work.length > 0) {
      const top = work[work.length - 1]!;
      const next = (out.get(top.v) ?? [])[top.i++];
      if (next !== undefined) {
        if (!idx.has(next)) {
          idx.set(next, index);
          low.set(next, index++);
          stack.push(next);
          on.add(next);
          work.push({ v: next, i: 0 });
        } else if (on.has(next)) low.set(top.v, Math.min(low.get(top.v)!, idx.get(next)!));
        continue;
      }
      work.pop();
      if (work.length > 0) {
        const parent = work[work.length - 1]!.v;
        low.set(parent, Math.min(low.get(parent)!, low.get(top.v)!));
      }
      if (low.get(top.v) === idx.get(top.v)) {
        const part: Id[] = [];
        let w: Id;
        do {
          w = stack.pop()!;
          on.delete(w);
          part.push(w);
        } while (w !== top.v);
        result.push(part);
      }
    }
  }
  const order = new Map(nodes.map((n, i) => [n.id, i]));
  return result.map((part) => part.sort((a, b) => order.get(a)! - order.get(b)!));
}

/** The edges that close the cycles among `members`: a depth-first walk's way back, from where the work enters. */
function wayBack(members: Set<Id>, edges: Edge[], preferred: Set<Id>, entry: Id): Id[] {
  const inside = edges.filter((e) => members.has(e.from) && members.has(e.to));
  // The preferred edges (grooph's dotted way back) win when taking them away leaves no cycle.
  const chosen = inside.filter((e) => preferred.has(e.id));
  if (chosen.length > 0 && !cyclic(members, inside.filter((e) => !preferred.has(e.id)))) return chosen.map((e) => e.id);
  const back: Id[] = [];
  const state = new Map<Id, 1 | 2>();
  const out = new Map<Id, Edge[]>();
  for (const e of inside) (out.get(e.from) ?? out.set(e.from, []).get(e.from)!).push(e);
  const work: { v: Id; i: number }[] = [];
  const visit = (v: Id): void => {
    state.set(v, 1);
    work.push({ v, i: 0 });
    while (work.length > 0) {
      const top = work[work.length - 1]!;
      const e = (out.get(top.v) ?? [])[top.i++];
      if (!e) {
        state.set(top.v, 2);
        work.pop();
        continue;
      }
      const s = state.get(e.to);
      if (s === 1) back.push(e.id);
      else if (s === undefined) {
        state.set(e.to, 1);
        work.push({ v: e.to, i: 0 });
      }
    }
  };
  visit(entry);
  for (const m of members) if (!state.has(m)) visit(m);
  return back;
}

function cyclic(members: Set<Id>, edges: Edge[]): boolean {
  const indegree = new Map<Id, number>([...members].map((m) => [m, 0]));
  const out = new Map<Id, Id[]>();
  for (const e of edges) {
    if (!members.has(e.from) || !members.has(e.to)) continue;
    indegree.set(e.to, indegree.get(e.to)! + 1);
    (out.get(e.from) ?? out.set(e.from, []).get(e.from)!).push(e.to);
  }
  const ready = [...members].filter((m) => indegree.get(m) === 0);
  let seen = 0;
  while (ready.length > 0) {
    const v = ready.pop()!;
    seen++;
    for (const to of out.get(v) ?? []) {
      indegree.set(to, indegree.get(to)! - 1);
      if (indegree.get(to) === 0) ready.push(to);
    }
  }
  return seen < members.size;
}

/**
 * The loops and groups that the boxes and the cycles make. A subgraph whose nodes hold a cycle is a loop: in
 * grooph's own text its label gives its name and mode, its dotted edges are its way back, and its note lists its
 * stops. Any other subgraph, and an agentflow's flow of flows, is a group. A cycle in no such box is a loop of its own.
 */
function boxesAndLoops(
  r: Reading,
  nodes: Node[],
  edges: Edge[],
  dotted: Set<Id>,
  carried: Map<Id, Stop[]>,
  at: Map<string, Id>,
  ours: boolean,
  own: (raw: string) => string,
  unique: (base: string, box?: boolean) => string,
  guesses: string[],
): { loops: Loop[]; groups: Group[] } {
  const kindOf = new Map(nodes.map((n) => [n.id, n.kind]));
  const order = new Map(nodes.map((n, i) => [n.id, i]));
  const names = new Map(nodes.map((n) => [n.id, n.name]));
  const named = (id: Id): string => names.get(id) ?? id;
  /** Names to say, five at most. */
  const some = (ids: Id[]): string => `${ids.slice(0, 5).map(named).join(", ")}${ids.length > 5 ? ` and ${ids.length - 5} more` : ""}`;
  // A dotted edge is grooph's way back in its own text; in anyone else's it is only a style.
  const preferred = new Set([...(ours ? dotted : []), ...carried.keys()]);
  const byOrder = (ids: Iterable<Id>): Id[] => [...ids].sort((a, b) => order.get(a)! - order.get(b)!);
  const entryOf = (members: Set<Id>): Id => edges.find((e) => !members.has(e.from) && members.has(e.to))?.to ?? byOrder(members)[0]!;
  const between = (members: Set<Id>, list: Edge[]): Edge[] => list.filter((e) => members.has(e.from) && members.has(e.to));
  // The mode grooph infers (`loopMode`): grind when every way back starts at a check.
  const modeOf = (back: Id[]): "grind" | "judgment" => (back.every((id) => kindOf.get(edges.find((e) => e.id === id)!.from) === "check") ? "grind" : "judgment");

  const teams = new Set(r.containers.flatMap((c) => (c.kind === "flow" && c.parent !== undefined && r.containers[c.parent]!.kind === "flow" ? [c.parent] : [])));
  const boxes = r.containers.map((c, i) => ({ c, i })).filter(({ c, i }) => c.kind === "subgraph" || teams.has(i));
  // Each box's depth, and the nodes each holds, nested boxes' included: worked out once, by walking up from each node.
  const depths = r.containers.map(() => 0);
  r.containers.forEach((c, i) => {
    for (let p = c.parent; p !== undefined; p = r.containers[p]!.parent) depths[i]!++;
  });
  const held = new Map<number, Set<Id>>();
  for (const n of r.nodes.values()) {
    const id = at.get(n.id);
    if (!id) continue;
    for (let p = n.parent; p !== undefined; p = r.containers[p]!.parent) (held.get(p) ?? held.set(p, new Set()).get(p)!).add(id);
  }
  const holds = (c: number): Set<Id> => new Set(held.get(c) ?? []);
  // "x is also a member of loop y": grooph's word for a node in two loops neither of which holds the other.
  const also = ours ? r.comments.flatMap((c) => /^(\S+) is also a member of loop (\S+)$/.exec(c)?.slice(1, 3) ?? []) : [];

  const covered = new Set<Id>();
  const open = (): Edge[] => edges.filter((e) => !covered.has(e.id));
  const loopBoxes = new Map<number, Loop>();
  // Innermost first, so an edge back belongs to the smallest loop that holds both its ends.
  for (const { c, i } of [...boxes].sort((a, b) => depths[b.i]! - depths[a.i]!)) {
    if (c.kind !== "subgraph") continue;
    const members = holds(i);
    const mine = own(c.id);
    for (let k = 0; k + 1 < also.length; k += 2) if (mine === also[k + 1] && order.has(also[k]!)) members.add(also[k]!);
    if (members.size === 0 || !cyclic(members, between(members, open()))) continue;
    const back = wayBack(members, open(), preferred, entryOf(members));
    for (const id of back) covered.add(id);
    const said = /^(.*) · (grind|judgment) loop$/.exec(c.label);
    const stops = [...notesIn(i), ...back.flatMap((id) => carried.get(id) ?? [])];
    const loop: Loop = {
      id: unique(own(c.id), true),
      name: said ? said[1]! : c.label,
      members: byOrder(members),
      back,
      ...(said && said[2] !== modeOf(back) ? { mode: said[2] as "grind" | "judgment" } : {}),
      stops,
    };
    loopBoxes.set(i, loop);
    if (!ours) guesses.push(`${loop.name}: a box holding a cycle, so a loop${stops.length === 0 ? " with no stops; grooph validate --loops says what it lacks" : ""}`);
    else if (stops.length === 0) guesses.push(`${loop.name}: a loop with no stops; grooph validate --loops says what it lacks`);
  }

  // The other boxes are groups. A group holds the nodes whose nearest group it is, and the groups inside it.
  const groupBoxes = boxes.filter(({ i }) => !loopBoxes.has(i));
  const groupIds = new Map(groupBoxes.map(({ c, i }) => [i, unique(own(c.id), true)]));
  const nearestGroup = (start: number | undefined): number | undefined => {
    for (let p = start; p !== undefined; p = r.containers[p]!.parent) if (groupIds.has(p)) return p;
    return undefined;
  };
  // Each node and each group under its nearest group, found once.
  const under = new Map<number, { nodes: Set<Id>; groups: Id[] }>();
  const slot = (g: number): { nodes: Set<Id>; groups: Id[] } => under.get(g) ?? under.set(g, { nodes: new Set(), groups: [] }).get(g)!;
  for (const n of r.nodes.values()) {
    const g = nearestGroup(n.parent);
    const id = at.get(n.id);
    if (g !== undefined && id) slot(g).nodes.add(id);
  }
  for (const box of groupBoxes) {
    const g = nearestGroup(r.containers[box.i]!.parent);
    if (g !== undefined) slot(g).groups.push(groupIds.get(box.i)!);
  }
  const groups: Group[] = groupBoxes.flatMap(({ c, i }) => {
    const members = [...byOrder(under.get(i)?.nodes ?? []), ...(under.get(i)?.groups ?? [])];
    if (members.length === 0) return [];
    guesses.push(`${c.label}: a box with no loop in it, so a group`);
    return [{ id: groupIds.get(i)!, name: c.label, members }];
  });

  // A cycle in no box is a loop of its own.
  const loops = [...loopBoxes.entries()].sort((a, b) => a[0] - b[0]).map(([, loop]) => loop);
  // The parts are apart, so each is handed only the edges inside it, sorted out once.
  const remaining = open();
  const parts = components(nodes, remaining);
  const partOf = new Map<Id, number>();
  parts.forEach((part, k) => part.forEach((id) => partOf.set(id, k)));
  const insideOf = parts.map((): Edge[] => []);
  for (const e of remaining) if (partOf.get(e.from) === partOf.get(e.to)) insideOf[partOf.get(e.from)!]!.push(e);
  parts.forEach((part, k) => {
    const members = new Set(part);
    const inside = insideOf[k]!;
    if (part.length < 2 && !inside.some((e) => e.from === e.to)) return;
    if (!cyclic(members, inside)) return;
    const back = wayBack(members, inside, preferred, entryOf(members));
    for (const id of back) covered.add(id);
    const stops = back.flatMap((id) => carried.get(id) ?? []);
    const name = `${named(part[0]!)} loop`;
    loops.push({ id: unique(`${part[0]!}-loop`), name, members: part, back, stops });
    guesses.push(`${name}: the cycle through ${some(part)}, so a loop${stops.length === 0 ? " with no stops; grooph validate --loops says what it lacks" : ""}`);
  });
  return { loops, groups };

  function notesIn(c: number): Stop[] {
    const stops: Stop[] = [];
    for (const n of r.nodes.values()) {
      if (n.parent !== c || !ours || !(n.classes.includes("stop") || (r.classes.get(n.id) ?? []).includes("stop") || n.id.startsWith("stops_"))) continue;
      const lines = (n.label ?? "").split("\n");
      // "stops" and then one per line; grooph's earlier export wrote one "stop: …" note per stop.
      for (const line of lines[0] === "stops" ? lines.slice(1) : lines.map((l) => l.replace(/^stop: /, ""))) {
        const stop = readStop(line);
        if (stop) stops.push(stop);
        else guesses.push(`A stop it could not read was left out: "${line}"`);
      }
    }
    return stops;
  }
}

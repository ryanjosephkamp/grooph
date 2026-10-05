/**
 * How a tool's reply is laid out, so that nothing in it can pass for the tool speaking.
 *
 * A reply is lines. Every line opens with one of the tool's own labels (`LABELS`), and whatever comes from outside
 * the tool (a document, a template, an argument, the environment, a file's name, another session) is carried after
 * the label as a JSON string: a quote, a line break, a character that does not show and a look-alike letter are all
 * inside the quotes, where they are data. An id is no exception: an id is made from a name, and a name is anyone's
 * sentence with hyphens in it. Only a number, and a word from a closed list of the tool's own (`word`), stands bare.
 * The last line may be the tool's own `next:` line, which holds the tool's words and tool and argument names, and
 * nothing at all from outside: where it needs an id or a slot's key, it points at the line that holds it.
 *
 * There is no list of characters to keep up with: a line's first word is the tool's by construction, and
 * `test/reply-lines.test.ts` holds it with strings drawn from all of Unicode in every field of every input.
 */

import type { IssueLike } from "@grooph/core";

import { fixLines } from "./fixes.js";

type Json = Record<string, unknown>;

/** A value from outside the tool, as a reply carries it: a JSON string. */
export const q = (value: unknown): string => JSON.stringify(typeof value === "string" ? value : String(value));

/** What an id is made of (graph-ir section 1). */
export const ID = /^[a-z][a-z0-9-]*$/;

/** A word from a closed list of the tool's own (a kind, a tier, a target), said bare; anything else is someone's text. */
export const word = (value: unknown, allowed: readonly string[]): string => (typeof value === "string" && allowed.includes(value) ? value : q(value));

/** A rule's code as a line says it: bare when it has a code's shape. */
const code = (value: string): string => (/^[EW]_[A-Z0-9_]+$/.test(value) ? value : q(value));

/**
 * The words a line may open with. Each is the tool's own; none is ever taken from a document. A line that opens
 * with anything else is a mistake in the tool, and `reply` carries it whole as a JSON string after `text:`.
 */
export const LABELS = [
  "refused:", "failed:", "text:",
  "error ", "warning ", "warning:", "warnings:", "fix ", "issues:", "note:", "wrote ",
  "template ", "templates:", "Summary:", "When to use:", "Not for:", "Profile:", "Shape:", "Inspired by:", "Slots:", "slot ", "slots unfilled:",
  "when:", "not for:", "shape:", "slots:",
  "graph ", "loop ", "loops:", "stop:", "gates:", "gate ", "worst case:", "applied ", "tiers:", "tiers in this package:",
  "proposal set ", "candidate ", "map ", "run ", "by hand:", "document:", "link ", "embed:",
  "picture of ", "PNG:", "no PNG:",
  "package for ", "file ", "replaced ", "changed the model of ", "model of ", "loosens ", "brakes:", "kickoff:",
  "Plan recorded:", "Noted", "sessions:", "session:", "agent:", "plan:",
] as const;
const LABELED = new RegExp(`^ *(?:${LABELS.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`);

/** What ends a line, or hides in one. */
const CONTROL = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]+/g;

/** One line of a reply stays one line: every run of control characters becomes a space, inside a JSON string too. */
export const oneLine = (text: string): string => text.replace(CONTROL, " ");

/**
 * The lines of a reply, then the tool's own `next:` line when it has one. Each line is held to one line and opens
 * with a label; an empty line is left out.
 */
export function reply(lines: readonly string[], next?: string): string {
  const said = lines.flatMap((line) => {
    const one = oneLine(line);
    if (one.trim() === "") return [];
    return [LABELED.test(one) ? one : `text: ${JSON.stringify(one)}`];
  });
  return [...said, ...(next === undefined ? [] : [`next: ${oneLine(next)}`])].join("\n");
}

/**
 * A tool cannot do what was asked. `lines` say why: the first is a sentence of the tool's with outside values as
 * JSON strings (`q`), said after `refused:`; the rest are labeled lines (issues, files). `next` says what to call
 * instead, in the tool's words alone.
 */
export class Refusal extends Error {
  readonly lines: string[];
  readonly next: string;
  readonly data: Json | undefined;
  constructor(lines: string | string[], next: string, data?: Json) {
    const all = Array.isArray(lines) ? lines : [lines];
    super(all[0] ?? "refused");
    this.name = "Refusal";
    this.lines = all;
    this.next = next;
    this.data = data;
  }
}

/** A refusal as a reply's lines. */
export const refusalText = (r: Refusal): string => reply([`refused: ${r.lines[0] ?? ""}`, ...r.lines.slice(1)], r.next);

const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

/** One issue as a line: its severity, its code, what it says and the ids it is at, each as a JSON string. */
export const issueLine = (issue: IssueLike): string =>
  `${issue.severity === "error" ? "error" : "warning"} ${code(issue.code)} ${q(issue.message)}${issue.at.length > 0 ? ` at ${issue.at.map(q).join(", ")}` : ""}`;

/** The issue lines a refusal carries: each with its code, then one `fix` line per code. */
export const issueLines = (issues: readonly IssueLike[]): string[] => [...issues.map(issueLine), ...fixLines(issues)];

export const counted = (issues: readonly IssueLike[]): string => {
  const errors = issues.filter((i) => i.severity === "error").length;
  return `issues: ${plural(errors, "error")}, ${plural(issues.length - errors, "warning")}`;
};

/** A document's issues as lines: that there are none, or the count, each issue, and what to do about each code. */
export const issuesBlock = (issues: readonly IssueLike[]): string[] => (issues.length === 0 ? ["issues: none"] : [counted(issues), ...issueLines(issues)]);

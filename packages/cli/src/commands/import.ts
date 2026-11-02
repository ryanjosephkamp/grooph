import { basename } from "node:path";

import { canonicalize, formatIssue, readMermaid, validate } from "@grooph/core";

import { readText, writeText } from "../io.js";
import type { Output } from "../print.js";

export const IMPORT_HELP = `grooph import <file.mmd | -> [--name <name>] [--out <graph file>]

Read Mermaid text into a graph document: a flowchart (or graph) or an
agentflow-beta, as grooph mermaid writes them or as people write them by hand.
A Markdown file's first \`\`\`mermaid block is read the same way.

A node's shape says its kind: { } a critic, {{ }} a check, [/ \\] a human gate,
(( )) a merge, ((( ))) a stop, and any other shape an agent. In an agentflow a
flow is an agent (its model and instruction carried over), an action is a
person's step, a decision is a check, and an input is the goal. A cycle becomes
a loop, and a subgraph that holds no loop becomes a group. Text that grooph
mermaid wrote comes back with its loops' names and stops.

What the text cannot say, such as a brief or an agent's outputs, is filled in,
and each guess is printed on stderr, one per line. Loop rules are advice, so a
sketch with no stops still opens: grooph validate --loops says what each loop
lacks. Anything else in the text is refused, with what was met and what is read.

Reads stdin with -. Prints the document, or writes it with --out. --name names
the graph when the text does not.`;

/** `grooph import <file | -> [--name <name>] [--out <file>]`. Exit 1 when the text is refused or the document has errors. */
export function importCommand(io: Output, file: string, flags: { out?: string; name?: string }, readStdin: () => string): number {
  const source = file === "-" ? readStdin() : readText(file);
  const name = flags.name ?? (file === "-" ? undefined : basename(file).replace(/\.(mmd|mermaid|md|markdown|txt)$/i, ""));
  const read = readMermaid(source, name !== undefined && name !== "" ? { name } : {});
  if (!read.ok) {
    io.err(`grooph: ${file === "-" ? "the text on stdin" : file} is not Mermaid grooph reads: ${read.error}${read.line !== undefined ? ` (line ${read.line})` : ""}`);
    return 1;
  }
  for (const line of read.guesses) io.err(`guessed: ${line}`);
  const errors = validate(read.doc).filter((issue) => issue.severity === "error");
  for (const issue of errors) io.err(formatIssue(issue));
  const text = canonicalize(read.doc);
  if (flags.out !== undefined) {
    writeText(flags.out, text);
    io.out(`wrote ${flags.out}`);
  } else io.out(text.replace(/\n$/, ""));
  return errors.length > 0 ? 1 : 0;
}

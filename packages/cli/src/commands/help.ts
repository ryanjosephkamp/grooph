/**
 * The short overview (`grooph --help`), the help of the commands that had none, and the
 * "did you mean" for a mistyped command. The longer pages live beside their commands.
 */

import { KNOWN_TARGETS } from "@grooph/core";

export const overview = (version: string): string => `grooph ${version}: author, check and compile multi-agent loop graphs. It never runs them.

Usage: grooph <command> [options]      grooph help <command> for one command in full

Start
  new          make an empty graph document
  template     list, show and use ready-made graphs (try: template list)
  apply        change a graph with a list of JSON ops
  pick         write one candidate of a proposal set out as a graph

Check
  validate     check a graph or an operation map; say what to fix
  explain      what bounds a graph: rounds, budgets, gates, worst case
  shape        counts and brakes at a glance
  canonicalize print or rewrite a document in canonical form

Compile
  export       write the prompt package for a harness (${KNOWN_TARGETS.join(", ")})
  adopt        take a run's working copy as the graph's next version

See
  image        a picture of a graph or map, SVG or PNG
  outline      the whole document as Markdown to read
  page         one offline HTML file with a viewer
  glyph        the small wordless picture of a graph's shape
  mermaid      a one-way Mermaid flowchart

Watch
  watch        serve the app and the live run to this machine's browser
  runs         list, show or bundle what runs left behind
  hooks        install the event hook (it records and never steers)
  sessions     what the hook has seen
  events       push or inspect recorded events
  mcp          an MCP server for a session to call

Share
  share        a link that opens a graph, set, run or map in the app
  embed        one line of HTML that shows a graph on any page

First time? docs/quickstart.md.   grooph --version prints the version.`;

/** Commands the overview lists, for the "did you mean" and the unknown-command check. */
export const COMMANDS = [
  "new", "template", "apply", "pick", "validate", "explain", "shape", "canonicalize", "export", "adopt",
  "image", "outline", "page", "glyph", "mermaid", "watch", "runs", "hooks", "sessions", "events", "mcp", "share", "embed",
] as const;

/** Edit distance with transposition counted as one edit. */
function distance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j += 1) d[0]![j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i]![j] = Math.min(d[i]![j]!, d[i - 2]![j - 2]! + 1);
    }
  }
  return d[a.length]![b.length]!;
}

/** The nearest command to what was typed, when one is close enough to be a typo. */
export function nearestCommand(typed: string): string | undefined {
  const lower = typed.toLowerCase();
  let best: { name: string; score: number } | undefined;
  for (const name of COMMANDS) {
    // A prefix of a command ("valid") is as good as a one-edit typo.
    const score = name.startsWith(lower) && lower.length >= 3 ? 1 : distance(lower, name);
    if (best === undefined || score < best.score) best = { name, score };
  }
  const limit = Math.max(1, Math.floor(typed.length / 3));
  return best !== undefined && best.score <= limit ? best.name : undefined;
}

export const NEW_HELP = `grooph new --name <name> [--goal <goal>] [--target <harness>] [--out <file>] [--force]

Make a minimal graph document: the id is the name's slug, no nodes yet.
At a terminal it writes <id>.grooph.json here; piped, or with --out, it prints or writes
where you say. It never overwrites a file without --force.

Example
  grooph new --name "Fix the flaky test" --target claude-code`;

export const APPLY_HELP = `grooph apply <file> --ops <ops.json | -> [--write] [--for-export] [--json]

Apply a JSON list of document operations ({"op": "addNode", ...}; the list is in
packages/core/README.md), read from a file or from stdin with --ops -. All or nothing: an op
that cannot apply is named and nothing is written. Prints the resulting issues; --write saves
the result in canonical form (never one that fails the schema). Exits 1 while errors remain.

Example
  echo '[{"op":"addNode","kind":"agent","name":"Builder"}]' | grooph apply g.grooph.json --ops - --write`;

export const VALIDATE_HELP = `grooph validate <file> [--for-export] [--json]

Check a document against the schema and the rules in docs/graph-ir.md §3; docs/rules.md lists
every code with an example. Exits 1 when there are errors. --for-export also applies the
export-only rules (E_NO_TARGET, E_NO_GOAL); --json prints the issue list as JSON. A proposal
set is not a graph (grooph share checks one). An operation map (*.grooph-map.json) is checked
against its own rules, docs/operation-map.md §3.

Example
  grooph validate --for-export flaky.grooph.json`;

export const CANONICALIZE_HELP = `grooph canonicalize <file> [--write]

Print the document in canonical form (docs/graph-ir.md §7), or rewrite the file with --write.

Example
  grooph canonicalize g.grooph.json --write`;

export const EXPORT_HELP = `grooph export <file> --target <harness> --into <dir> [--models <tier>=<model>,...]

Validate for export, then write the harness package into <dir> and print the kickoff prompt.
Refuses, with the reasons, when the document has errors. Targets: ${KNOWN_TARGETS.join(", ")}.

  --models <tier>=<model>,...   which model a tier means in this package: frontier, strong, fast.
                                A tier not named keeps the target's own; a pin on a node still wins.
                                GROOPH_MODELS in the environment says the same for every export
                                on a machine; the flag wins over it. The graph does not change.

Example
  grooph export flaky.grooph.json --target claude-code --into .
  grooph export flaky.grooph.json --target claude-code --into . --models frontier=opus,strong=sonnet,fast=haiku`;

export const EXPLAIN_HELP = `grooph explain <file> [--json]

Say in plain words what bounds a graph: for each loop, how many rounds at most, its budget and
what happens at each stop; every human gate and what it guards; and the worst case in one line.
It adds no rule: it reads what the validator reads. --json gives the same as data.

Example
  grooph explain flaky.grooph.json`;

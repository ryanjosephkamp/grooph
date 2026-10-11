/**
 * The short overview (`grooph --help`), the help of the commands that had none, and the
 * "did you mean" for a mistyped command. The longer pages live beside their commands.
 */

export const overview = (version: string): string => `grooph ${version}: author and check multi-agent loop graphs. It never runs them.

Usage: grooph <command> [options]      grooph help <command> for one command in full

Start
  new          make an empty graph document
  template     list, show and use ready-made graphs (try: template list)
  sub          place a template inside a graph as one box, and keep it current
  apply        change a graph with a list of JSON ops
  pick         write one candidate of a proposal set out as a graph

Check
  validate     check a graph or an operation map; say what to fix
  explain      what a graph's brakes are: rounds, budgets, gates, worst case
  shape        counts and brakes at a glance
  canonicalize print or rewrite a document in canonical form

See
  plan         a plan for people to follow: PLAN.md, the picture and the document
  image        a picture of a graph or map, SVG or PNG
  outline      the whole document as Markdown to read
  page         one offline HTML file with a viewer
  glyph        the small wordless picture of a graph's shape
  mermaid      a one-way Mermaid flowchart

Watch
  watch        serve the app and the live sessions to this machine's browser
  hooks        install the event hook (it records and never steers)
  sessions     what the hook has seen
  events       push or inspect recorded events
  mcp          an MCP server for a session to call

Share
  share        a link that opens a graph, set, run or map in the app
  embed        one line of HTML that shows a graph on any page

First time? https://ryanjosephkamp.github.io/grooph/docs/quickstart/   grooph --version prints the version.`;

/** Commands the overview lists, for the "did you mean" and the unknown-command check. */
export const COMMANDS = [
  "new", "template", "sub", "apply", "pick", "validate", "explain", "shape", "canonicalize",
  "plan", "image", "outline", "page", "glyph", "mermaid", "watch", "hooks", "sessions", "events", "mcp", "share", "embed",
] as const;

/**
 * What grooph had through 0.4.1 and has no longer (decision 0032: it draws workflows and watches them, and does not
 * direct a session). Each answers with one line and exit code 1, has no help page, and is never a "did you mean".
 */
export const GONE: readonly string[] = ["export", "adopt", "runs"];
export const gone = (command: string): string =>
  `grooph: ${command} is no longer part of grooph, which draws workflows and watches them and no longer directs a session. Version 0.4.1 on npm still has it, and the repository keeps it as a lab (lab/README.md: grooph-lab ${command}).`;
/** `grooph watch <run dir | graph dir>`: the one part of a command that stays which left. */
export const WATCH_GONE =
  "grooph: watch no longer takes a run or a graph folder: grooph no longer directs a session, so it has no run to follow. Version 0.4.1 on npm still does, and the repository keeps that as a lab (lab/README.md: grooph-lab watch <run dir>). With no folder, grooph watch serves the sessions the event hook has seen.";

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
export function nearestCommand(typed: string, commands: readonly string[] = COMMANDS): string | undefined {
  const lower = typed.toLowerCase();
  let best: { name: string; score: number } | undefined;
  for (const name of commands) {
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

The graph a package keeps (.grooph/<id>/graph.grooph.json) is not written by apply, or by any
command of grooph's: what placed the package compares the next graph with it. Work on a copy of
your own, .grooph/graphs/<id>.grooph.json by habit.

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

export const EXPLAIN_HELP = `grooph explain <file> [--json]

Say in plain words what a graph's brakes are: for each loop, how many rounds at most, its budget and
what happens at each stop; every human gate and what it guards; and the worst case in one line.
It adds no rule: it reads what the validator reads. --json gives the same as data.

Example
  grooph explain flaky.grooph.json`;

/**
 * The lab's own pages (`grooph-lab --help`, `grooph-lab help export`) and its "did you mean": what `grooph` said
 * of these through 0.4.1, word for word, moved here when the commands left the product (slice 0103). They say
 * `grooph` and not `grooph-lab` because that is what was said, and because a run finds the lab's command under that
 * name on its path.
 */

import { KNOWN_TARGETS, SHARE_BASE, SHARE_LINK_WARN, getProfile } from "@grooph/core";

/** Each target's own tier map, as its profile has it, for the export's help. */
const ownTiers = (target: string): string =>
  Object.entries(getProfile(target).models)
    .map(([tier, model]) => `${tier} → ${model}`)
    .join(", ");
const OWN_TIERS = ownTiers("claude-code");
const OWN_TIERS_CODEX = ownTiers("codex");

export const overview = (version: string): string => `grooph ${version}: author, check and compile multi-agent loop graphs. It never runs them.

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

Compile
  export       write the prompt package for a harness (${KNOWN_TARGETS.join(", ")})
  adopt        take a run's working copy as the graph's next version

See
  plan         a plan for people to follow: PLAN.md, the picture and the document
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

First time? https://ryanjosephkamp.github.io/grooph/docs/quickstart/   grooph --version prints the version.`;

/** Commands the overview lists, for the "did you mean" and the unknown-command check. */
export const COMMANDS = [
  "new", "template", "sub", "apply", "pick", "validate", "explain", "shape", "canonicalize", "export", "adopt",
  "plan", "image", "outline", "page", "glyph", "mermaid", "watch", "runs", "hooks", "sessions", "events", "mcp", "share", "embed",
] as const;

export const EXPORT_HELP = `grooph export <file> --target <harness> --into <dir> [--models <tier>=<model>,...] [--change-models] [--allow <change>]... [--uncompared]

Validate for export, then write the harness package into <dir> and print the kickoff prompt.
Refuses, with the reasons, when the document has errors. Targets: ${KNOWN_TARGETS.join(", ")}.
It says what each tier means in the package every time, and names each pin.
A package is one harness's files: --target is the harness the document names (target.harness),
and a document that names another is refused (E_NO_TARGET) until it names this one:
  echo '[{"op":"setTarget","harness":"codex"}]' | grooph apply flaky.grooph.json --ops - --write
  grooph export flaky.grooph.json --target codex --into <a project that does not hold its claude-code package>
Two packages of one graph in one folder are a mixed package: export does not yet notice the other's files.
It does read the graph the package there keeps: where that names the other harness, it says so, writes
nothing, and waits for --uncompared.

  --models <tier>=<model>,...   which model a tier means in this package: frontier, strong, fast.
                                A tier not named keeps the target's own; a pin on a node still wins.
                                GROOPH_MODELS in the environment says the same for every export
                                for claude-code on a machine, and GROOPH_MODELS_CODEX for every
                                export for codex: a model's name is one harness's, so neither is
                                read for the other target. The flag wins. The graph does not change.
  --change-models               go ahead when the export would change the model of an agent file
                                already in <dir>, or cannot read one for its model (a header not in
                                the plain form grooph writes). Without it such an export stops, lists
                                each file with its model before and after, and writes nothing.
  --allow <change>              place a change that may remove or loosen a brake of the graph the
                                package in <dir> keeps, by the name a refused export lists it under
                                (loop:review.stops); repeatable
  --uncompared                  place the graph where a package is in <dir> and nothing can be
                                compared (see below)

The brakes. A package keeps the graph it was written from (.grooph/<id>/graph.grooph.json). Over a
package already in <dir> for the same graph id, the graph coming in is held to that graph's brakes,
by the comparison grooph adopt makes (grooph adopt --help): a loop's round cap or budget raised, a
gate or an approval gone, a bar's acceptance changed, a critic's isolation dropped, a check changed
or removed. Each such change
is listed with its reason, nothing is written, and the exit code is 1, until each is asked for with
--allow. The comparison cannot tell a stricter wording or a renamed part from a looser one, so it
lists those too. A brake is removed or loosened only on a person's word: an agent that meets the
refusal puts each listed change to the person, and adds --allow only for the ones they said yes to.

The kept graph is a baseline only while it can be read as a graph, is this package's own, and the
lead's brief and the mapping notes in the package are what it compiles to. Where it is gone, cannot
be read as this package's graph, or does not match those two files (it was changed by hand, one of
them was, or another version of grooph wrote the package), nothing is called compared: the export
writes nothing and says why, and --uncompared places the graph on a person's word. What still reads
as loosened against a changed kept graph is held by name as well. A first export, and a graph under
a new id (a second package beside the first), compare nothing and need no flag. No command of
grooph's but export writes a kept graph: apply and the others refuse it.

The last line of the output opens "brakes:" and says which of these happened. The kickoff is the
graph's own words and may hold any line: it runs from the line after "Kickoff" to the line before
that last line, which is always grooph's own.

What the comparison holds and what it does not is in docs/runs.md, "What adoption does not hold";
it does not see the graph's own constraints (its budget line among them) or an edge's retry and
concurrency. "None of the brakes it compares" is all the last line says after a comparison. And the
baseline is not a seal: a hand that rewrites
the kept graph together with the brief and the mapping notes is not seen, nor is one that takes an
irreversible marker off the kept graph, which neither file shows.

An agent's file is named <graph id>--<node id>. Where this graph would write one that another
package in <dir> has as its own, nothing is written.

Every file is written inside <dir> by where it really is, never through a link at the file's own
place, and the package is placed whole or not at all.

A graph whose id is graphs, proposals, templates, events or hooks is not exported: a package lives in
.grooph/<id>/, and grooph keeps those folders for something else.

The targets' own tiers, for claude-code: ${OWN_TIERS}; for codex: ${OWN_TIERS_CODEX}.
In each, two of them are one model, so a critic on one over a builder on the other is the same model:
the export says so when a graph has agents on both.

Example
  grooph export flaky.grooph.json --target claude-code --into .
  grooph export flaky.grooph.json --target claude-code --into . --models frontier=opus,strong=sonnet,fast=haiku`;

export const SHARE_HELP = `grooph share <graph | proposal set | run dir | run bundle | operation map> [--base <url>] [--open] [--out <file>]

Turn a graph, a set of one to four candidate graphs, a run or an operation map into a link
that opens it in the grooph app on any device. The document travels in the link's #fragment, which browsers
do not send to any server; nothing is uploaded.

A run folder (.grooph/<graph-id>/runs/<run-id>/) or a *.grooph-run.json bundle opens in the
run view: what ran, what the run changed and why, its proposals, and its notes. --out then
writes the bundle, the fallback when the link is too long.

An operation map (*.grooph-map.json, docs/operation-map.md) opens as its picture with its
handoffs listed. A map is never compiled, so one with rule errors still shares: the view
shows them.

Validates first and refuses a graph, or a candidate, with errors. Inlines { "file" }
candidates, computes each candidate's shape, prints the comparison and the link with its
length, and warns when the link is over ${SHARE_LINK_WARN.toLocaleString("en")} characters (messengers cut long links).

  --base <url>   where the app is served (default ${SHARE_BASE});
                 http://localhost:4173/grooph/ for a local build
  --open         also open the link in the default browser
  --out <file>   also write the self-contained document (graphs inlined, shapes computed);
                 import it in the app when a link is too long to send

A proposal set, <set-id>.grooph-proposals.json (docs/executive.md §1):

  {
    "groophProposals": 0,
    "id": "csv-export",
    "title": "CSV export for the orders list",
    "brief": "The project and its constraints as you understood them.",
    "candidates": [
      {
        "id": "lean",
        "label": "Lean",
        "graph": { "file": "lean.grooph.json" },
        "basedOn": "grind-loop",
        "rationale": "Why this shape fits this project, in three or four sentences.",
        "pros": ["what it buys"],
        "cons": ["what it costs, and each validation warning in plain words"],
        "profile": { "cost": "low", "speed": "fast", "rigor": "light" }
      }
    ],
    "recommendation": { "candidate": "lean", "why": "One or two sentences." }
  }

  ids are kebab-case and unique; one to four candidates; labels distinct, case ignored
  (the owner picks by saying one back); "graph" is a path relative to this file's folder,
  or the graph document itself; "basedOn" and "recommendation" are optional; cost is
  low | medium | high, speed fast | medium | slow, rigor light | standard | high.
  Leave "shape" out: share computes it.`;

export const EMBED_HELP = `grooph embed <file> [--theme <name>] [--height <px>] [--frame] [--play] [--base <url>]

<file> is a graph, a run folder or *.grooph-run.json bundle, an operation map, or a proposal set.

Print the HTML that puts a live, read-only picture of the document in any web page: an
<iframe> on the first line, and on the second a one-line script that sizes the frame to the
picture. A reader can pan and zoom it, tap a node for its brief, and open it in grooph. A
run (a run folder or a *.grooph-run.json bundle) plays: play, step and a scrubber.

The document travels in the frame's address after the #, as in grooph share, so the host
page's server never sees it. Nothing about the reader is sent anywhere.

  --theme <t>    one of six looks for the picture: paper, blueprint, ink, phosphor, transit, chalk
                 (docs/themes.md); without it, paper. Or light or dark, which hold the picture
                 to that form; without one it follows the reader's color scheme. Both as
                 chalk-dark. The theme is in the frame's address, and fetched only then.
  --height <px>  the frame's height when the page has no script to size it
                 (default: the picture's own height at a phone's width)
  --frame        draw the embed's own background and border, not the page's background
  --play         start a run's replay as soon as it is shown
  --base <url>   where the app is served (default ${SHARE_BASE});
                 http://localhost:4173/grooph/ for a local build

Without the script the frame keeps its height, and the picture shrinks to fit or can be
dragged. Example:

  grooph embed review.grooph.json --theme light >> post.html`;

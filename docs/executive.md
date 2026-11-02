# Proposal sets and share links

How an agent offers one to four candidate diagrams for a person to compare on a phone, and how any grooph document travels in a link. The `grooph-design` skill uses both (§5).

1. The person describes the work; the agent reads the templates and makes one to three candidate diagrams, checked.
2. The candidates go in a proposal set, and `grooph share` turns it into a link that opens a side-by-side comparison on a phone.
3. The person picks one; `grooph pick` writes it out, and the agent hands over the chosen diagram, its picture, and its link.

## 1. Proposal set

A small document, `<set-id>.grooph-proposals.json`, that holds the candidates and the reasoning, so the comparison is data and not chat. Its JSON Schema is [`packages/core/schema/grooph-proposals-0.schema.json`](../packages/core/schema/grooph-proposals-0.schema.json).

```ts
type ProposalSet = {
  groophProposals: 0;
  id: Id; title: string;
  brief: string;                       // the project and its constraints, as the author understood them
  candidates: Candidate[];             // one to four
  recommendation?: { candidate: Id; why: string };
};
type Candidate = {
  id: Id; label: string;               // "Lean", "Fast", "Rigorous": a word the person can say back
  graph: Graph | { file: string };     // `{ file }` is relative to the set's folder; `grooph share` inlines it
  basedOn?: string;                    // template id, when it started from one
  rationale: string;                   // why this shape fits this project, three or four sentences
  pros: string[]; cons: string[];      // cons include each validation warning, in plain words
  profile: { cost: "low" | "medium" | "high"; speed: "fast" | "medium" | "slow"; rigor: "light" | "standard" | "high" };
  shape?: Shape;                       // computed by core (estimateShape), never written by hand
};
type Shape = { agents: number; people?: number; checks: number; gates: number; loops: number;
  tiers: Record<"frontier" | "strong" | "fast" | "unset", number>;
  worstCaseRounds: number | null;      // each loop's max-iterations summed, nested loops multiplied; null when a loop has none
  budgets: string[] };                 // each loop's budget stop, as text
```

`shape` is counts and brakes, never a dollar figure: `people` counts a person's steps (absent when none), and `gates` counts human-gate nodes and edges that need approval.

The rules (`validateProposalSet` in core), with a graph's issue shape `{ code, severity, message, at }`:

- `E_SCHEMA`: a field missing or of the wrong type, an id that is not kebab-case, or not one to four candidates.
- `E_DUPLICATE_ID`: an id used twice, the set's own included. `E_DUPLICATE_LABEL`: a label used twice, case ignored.
- `E_DANGLING_REF`: `recommendation.candidate` names no candidate.
- `E_CANDIDATE_INVALID`: an inlined graph has errors of its own, named in the message. The export check (a goal, a harness) does not apply, so a candidate may be a plan. A link or an `--out` file must carry every graph, so there a `{ file }` candidate is this error too.
- `W_UNKNOWN_KEY`: a key the schema does not know, kept and not read.

## 2. Share links

`https://ryanjosephkamp.github.io/grooph/#/open?d=<payload>`, where `payload` is base64url( raw DEFLATE( JSON ) ) and the JSON is `{ "v": 1, "kind": "graph" | "proposals" | "run" | "map", "doc": … }`. A graph keeps its `layout` and drops its run notes. (`run`, a recorded run, is experimental.)

- Everything is in the URL fragment, which browsers do not send to a server. Nothing is uploaded.
- Core builds and reads the envelope (`buildShareEnvelope`, `parseShareEnvelope`). The CLI compresses with `node:zlib` and the app with `fflate`, both raw DEFLATE; a test checks that each reads the other's output.
- `grooph share` refuses a graph or a set with errors (an operation map shares with its errors shown), inlines `{ file }` candidates, computes each `shape`, prints the link and its length, and warns above 32,000 characters, since messengers cut long links. `--out` writes the self-contained document for the app to import instead. `--base http://localhost:4173/grooph/` points at a local build.
- In the app, the editor's Export panel makes the same link for a graph (**Copy link**, and **Share…** where the device has a share sheet), from the page's own address, and refuses a graph with errors as `grooph share` does. It says a link over 32,000 characters is long.
- A link is **untrusted input**. A payload over 1,000,000 characters, or one that unpacks to more than 4 MB, is refused. The app checks the document with the same schema as an import, shows it read-only, stores nothing until the person taps **Save to this device**, and never exports from a link.
- `#/embed?d=` takes the same payload, for a picture inside another page (`grooph embed`; [exports](exports.md)).

## 3. Compare view

What `#/open` shows for `kind: "proposals"`. A single graph opens read-only in the viewer, with the same Save button.

- The set's title and brief, then one card per candidate: on a phone, a row to swipe through that opens on the recommended card; at desktop width, side by side with aligned rows.
- A card has the label, a **Recommended** badge with its why, the template it came from, profile chips, the shape line ("4 agents · 1 loop · up to 4 rounds · 10 dispatches"), the tier line, the rationale, the validation status, pros and cons, the graph's glyph, and **Open full graph**.
- **Choose <label>** copies one line for the chat: `I pick "<label>" (<candidate id>) from <set id>.` The person may also just say the label.
- **Save to this device** stores a candidate in the library, where it is editable like any other graph; **Save all** stores every candidate.

## 4. CLI commands

```
grooph share <file> [--base <url>] [--open] [--out <file>]
grooph pick <proposals file> <candidate id | label> --out <graph file> [--force]
grooph shape <graph file> [--json]
```

`grooph pick` writes one candidate out as an ordinary graph, named by its id or label, case ignored (a name that is one candidate's id and another's label is refused). Nothing is written while the graph has errors, and an existing `--out` is replaced only with `--force` or when it holds the same graph. `grooph shape` prints the shape line; `--json` prints the `Shape`. Among the MCP tools (experimental), `grooph_share` takes a set too; `grooph pick` has no tool.

## 5. The skill

[`plugins/grooph/skills/grooph-design/SKILL.md`](../plugins/grooph/skills/grooph-design/SKILL.md) holds the skill's judgment and steps, packaged as a Claude Code plugin in [`plugins/grooph/`](../plugins/grooph/). From a clone, `scripts/install-local.sh` links the CLI into `~/.local/bin/grooph` (or `--bin-dir`) and the skill into `~/.claude/skills/grooph-design`; it prints what it will touch first, and `--uninstall` removes both links.

The skill asks at most three questions, reads the library, builds one to three candidates that differ in shape in `.grooph/proposals/<set-id>/`, and checks each with `grooph validate --for-export` until no error is left but `E_NO_TARGET` or `E_PERSON_STEP_NOT_COMPILED`. It writes the proposal set with a recommendation, shares it, and gives the person the link and a comparison short enough for a phone. On the pick it makes any change asked for, runs `grooph pick <set> <candidate> --out .grooph/graphs/<graph-id>.grooph.json`, and hands over the diagram's link (`grooph share`) and picture (`grooph image`), with an embed (`grooph embed`) or an offline page (`grooph page`) when asked. For a plan a person follows, it also writes `PLAN.md` (`grooph plan <file> --into plans/<graph-id>`).

The skill starts nothing: a diagram is not an instruction. A prompt package for a harness is no part of it; that belongs to [the lab](lab.md) and is experimental.

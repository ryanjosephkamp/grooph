# The executive path

Normative for slice 0006. How a harness session proposes graphs, how the owner sees them on a phone, and how a pick becomes a running package. grooph still makes no model calls: the executive is the harness session following the `grooph-design` skill and using the CLI.

```
describe project ─► skill reads templates ─► 1–3 candidate graphs, validated
      ─► proposal set ─► `grooph share` ─► link ─► compare view on the phone
      ─► owner picks ─► `grooph pick` ─► `grooph export --into .` ─► kickoff (owner says go)
```

## 1. Proposal set

A small document, `*.grooph-proposals.json`, that holds the candidates and the reasoning, so the comparison is data and not chat.

```ts
type ProposalSet = {
  groophProposals: 0;
  id: Id; title: string;
  brief: string;                       // the project and its constraints as the executive understood them
  candidates: Candidate[];             // one to four
  recommendation?: { candidate: Id; why: string };
};
type Candidate = {
  id: Id; label: string;               // "Lean", "Fast", "Rigorous": a word the owner can say back
  graph: Graph | { file: string };     // `{ file }` is relative to the proposal set's folder; resolved and inlined by `grooph share`
  basedOn?: string;                    // template id, when it started from one
  rationale: string;                   // why this shape fits this project, three or four sentences
  pros: string[]; cons: string[];      // cons include any validation warning, in plain words
  profile: Profile;                    // cost · speed · rigor, as in docs/templates.md
  shape?: Shape;                       // computed by core, never written by the executive
};
type Shape = { agents: number; checks: number; gates: number; loops: number;
  tiers: Record<"frontier" | "strong" | "fast" | "unset", number>;
  worstCaseRounds: number | null;      // sum over loops of their max-iterations (nested loops multiply); null when a loop has none
  budgets: string[] };                 // each loop's budget stop, as text
```

`shape` is structural and honest: counts and brakes, no dollar figures. `estimateShape(graph)` lives in core.

Rules (`validateProposalSet` in core, same issue shape as graphs): ids unique; one to four candidates; every inlined graph has no export errors (`E_CANDIDATE_INVALID`, naming the candidate and the underlying codes); labels distinct; `recommendation.candidate` exists.

## 2. Share links

`https://ryanjosephkamp.github.io/grooph/#/open?d=<payload>` where `payload` = base64url( raw DEFLATE( JSON ) ) and the JSON is `{ "v": 1, "kind": "graph" | "proposals", "doc": … }` with the graph's `layout` kept and run notes dropped.

- Everything is in the URL fragment, which browsers do not send to the server. Nothing is uploaded anywhere.
- Core owns the envelope (`buildShareEnvelope`, `parseShareEnvelope`, with validation and clear errors). Compression is a shell concern so core keeps zero dependencies: the CLI uses `node:zlib`, the web app uses the zip library it already has. Both must produce and accept raw DEFLATE, and a test proves each side reads the other's output.
- `grooph share <graph | proposals> [--base <url>] [--open] [--out <self-contained file>]` validates first, inlines `{ file }` candidates, computes `shape`, prints the link and its length, and warns above 32,000 characters (messengers truncate long links; the `--out` file is the fallback, importable in the app). `--base http://localhost:5173/grooph/` serves local review.
- A link is **untrusted input**. The app parses it with the same schema check as an import, renders it read-only, stores nothing until the person taps **Save to this device**, and never exports straight from a link.

## 3. Compare view

What `#/open` shows for `kind: "proposals"`; a single graph opens in the read-only canvas with the same Save button.

- Phone first: the brief at the top, then one card per candidate, swipeable. A card carries the label, the recommended badge with its why, profile chips, the shape line ("4 agents · 1 loop · up to 4 rounds · 40 turns"), rationale, pros and cons, validation status, a read-only auto-laid-out canvas, and "Open full graph".
- At desktop width the cards sit side by side with aligned rows, so the differences read across.
- **Choose** copies one line for the chat: `I pick "<label>" (<candidate id>) from <set id>.` The owner may also just say the label.
- **Save to this device** stores the chosen graph (or all of them) in the library, where it is editable like any other.

## 4. CLI additions

```
grooph share <file> [--base <url>] [--open] [--out <file>]
grooph pick <proposals file> <candidate id | label> --out <graph file>
grooph shape <graph file> [--json]
```

## 5. The skill

`plugins/grooph/skills/grooph-design/SKILL.md`, written by the driver, versioned here, and the only place the product's recommendation judgment lives. It is packaged as a Claude Code plugin in this repo so another person can install it from the repository; for the owner's own machine `scripts/install-local.sh` links the CLI onto `PATH` and installs the skill for the user. The owner runs that script themselves.

The skill must not start a run. Placing the package is setup; spending tokens on the run waits for the owner's word.

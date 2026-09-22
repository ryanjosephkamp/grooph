# gauntlet-decomposed · one proving run

**Run** `20260922-151855` · Claude Code 2.1.278 · lead `claude-opus-5`, planner and critic `claude-fable-5-1` (tier frontier), owner `claude-opus-5` (tier strong) · **$6.95** over two invocations ($1.59 kickoff, $5.36 resume) · 35 harness turns · 757 s · evidence in [`run/`](run/) · **`--check` fails** · **the bet did not pay: no `e-critic-fail`, and the run halted on the outer loop's human stop before the integrator**

_Pre-registered 2026-09-22 before the run (commit `experiments: gauntlet-decomposed task …`); the sections after "Pre-registration" are written from the record afterwards. The record is kept red as it is (decision 0009): what failed is inside the package, so it is a finding, not a retry._

**Credits:** Matt Shumer's Gauntlet Loop and the Claude of Duty repository: decompose, then builder plus fresh critic per piece against a real reference, blind side by side; here bounded, and pieces run in sequence because the repository's own note says fan-out lost on coupled work.

## Pre-registration

**Task.** [`task/`](task/): `summary-card`, a 640 × 360 SVG card for a monthly review deck, composed by `src/card.mjs` from two pieces along a real seam: `src/header.mjs` (title, period, three stat tiles) and `src/trend.mjs` (twelve monthly bars). The first version is crude: raw integers in a line of 12px text, black bars, no margins, no months, no tiles. [`BRIEF.md`](task/BRIEF.md) says in words what the card should be; `npm run capture` writes `captures/card.svg` and `captures/CAPTURE.md`, an element-by-element account (group, kind, position, size, colour, text) a critic can set beside any other SVG described the same way. The reference is held out ([`held-out/`](held-out/)): the card itself, the same element-by-element description of it, and [`REFERENCE.md`](held-out/REFERENCE.md), ten ranked points with what counts as major.

**The mechanism: a held-out reference, cut per piece.** The planner reads the reference and cuts the pieces with a reference cut each; the piece critic and the final critic judge against it; the owner and the integrator work from `PIECES.md` and are told it is not theirs to read.

**Why a first pass should fail.** For piece 1 (the header) the brief's words admit an obvious rendering that the reference contradicts on properties only a side-by-side shows: the reference's three tiles span the card's inner width on a shared value baseline, the change line is coloured and marked by sign (green ▲ / red ▼, and Orders *fell*), and the values are in a compact spoken form. A builder working from `BRIEF.md` alone will plausibly produce three left-aligned labelled numbers of its own spacing, uncoloured, and perhaps `$1,423,000`. Each of those is major by `REFERENCE.md`'s own definition. The bet: **`e-critic-fail` fires at least once, both pieces end ticked in `PIECES.md`, the owner and the integrator never read the held-out folder, both critics do, and the run halts at `release-gate`.**

**Expected probability.** Round-0 pass for piece 1: about 0.25 (the brief names the compact form, so that one gap is likely closed; the tile geometry and the signed colour are not named). At least one `e-critic-fail` across the two pieces: about 0.85. Both pieces ticked within the outer cap: about 0.8, the risk being the session's dollar ceiling rather than the graph's stops. What `--check` asserts is in [`expect.json`](expect.json): five agents as their own subagents, `dispatches` (owner ≥ 2, critic ≥ 2), each critic's own report, `heldOut` readers and non-readers, `backEdge`, `ending: halt at release-gate`.

**One scripted gate answer.** This graph's first gate, `decomposition-gate`, stands between the planner and everything the template is for. The owner decided on 2026-09-22 that this gate, and only this one, gets a scripted `approve` once the run has halted there with its note, as `spec-then-loop`'s first gate did in batch one; the release gate at the end is answered by nobody, and the halt there is the ending. The scripted answer is a second invocation on the same session, labelled in the ledger.

**Shape.** `planner` (frontier) → `decomposition-gate` → loop `pieces` (judgment, one piece per outer round; bar: every box in `PIECES.md` ticked; stops bar-passed → `integrator`, human every 2, max-iterations 4, budget 42 dispatches) over `owner` (strong) → `capture-check` (`npm run capture`) → `critic` (frontier, fresh; inner loop `polish`: bar-passed, diminishing-returns 2, max-iterations 3, budget 10) → `next-piece` check (`grep -q '^- \[ \]' PIECES.md`) → owner on pass, `integrator` on fail → `final-critic` (frontier, fresh) → `release-gate` → `done`.

**Spend expected:** about $6 to $8 over two invocations (kickoff to the gate, then the resume through both pieces and the ending), each capped at $9.00. Ledger cap $75.00, $24.43 available before this run.

## What happened

| round | node | result | record |
|---|---|---|---|
| — | planner | cut **three** pieces, not two: the card frame (`src/card.mjs`), the header (`src/header.mjs`), the trend (`src/trend.mjs`), one per source file; `PIECES.md` is 175 lines | `n-0003`, [`PIECES.md`](run/project.diff) |
| — | decomposition-gate | **halt note first** (`n-0004`), then the ask; the scripted `approve` resumed the session and the lead recorded it (`n-0005`) and then corrected its own estimated timestamp in a second note (`n-0007`) | [`notes.jsonl`](run/runs/20260922-151855/notes.jsonl) |
| pieces 0 / polish 0 | owner → capture-check → critic | piece 1: one `Edit` adding the frame rect; capture regenerated; the critic compared and **passed at round 0**, ticking the box | `n-0009`–`n-0013` |
| pieces 0 | next-piece | `grep -q '^- \[ \]' PIECES.md` exit 0: two pieces remain; **`e-next-piece-pass` taken** | `n-0014`, `n-0015` |
| pieces 1 / polish 0 | owner → capture-check → critic | piece 2: `renderHeader` rewritten with three tiles plus a new `src/format.mjs`; the critic **passed at round 0** | `n-0017`–`n-0021` |
| pieces 1 | next-piece, loop | a piece remains (the trend); the loop evaluated its stops and **the `human` stop, due every second round, fired**: "halting to report to the human before piece 3" | `n-0022`, `n-0023` |

**Ending:** `stop human` on the outer loop at round 1, with a halt note. `integrator`, `final-critic` and `release-gate` never ran, so `FINAL.md` does not exist and one piece is still unticked. Both inner loops passed at round 0 with `stop: bar-passed` on their notes; the polish counter restarted for piece 2, as graph-ir §2 says a nested loop's does. No amendment, no proposal, **zero denials**, and the working copy is identical to the source.

## Did a back edge fire, and what caught it

**The outer loop's did (`e-next-piece-pass`, once), the inner loop's did not.** The piece critic passed both pieces at round 0, so `e-critic-fail` never fired and the bet's central line did not pay.

**Why, and it is the template's doing.** The planner is told to write each piece's "cut of `{{reference}}` (what it must match)", and a frontier planner with the reference's element-by-element description in front of it writes that cut as exact SVG: `PIECES.md` contains the frame rect literally (`<rect x="0.5" y="0.5" width="639" height="359" rx="12" fill="#ffffff" stroke="#e5e7eb"/>`), a palette of nine named hex values, the margin, the tile geometry, the baselines and the capture line each element must produce — under the heading "copy them exactly; owners do not see the reference". The owner then reproduced the reference through `PIECES.md`, and the critic's own report says so: "with labels stripped the two header groups cannot be told apart: every one of the 14 rows … is byte-identical". **The planner leaked the answer key into the document the owner works from**, which is exactly the hole the held-out mechanism exists to close, opened by a node inside the graph rather than by the task.

The blind A/B the brief asks for did happen and is legible in [`GAPS.md`](run/project.diff): "Two header captures, A and B, 14 rows each … Which is better: neither … (A was the revision, B the reference)". A critic that compares and finds nothing is doing its job; it had nothing to find.

## What `--check` reports, and what each problem means

Ten problems, of three kinds:

- **Six are the human stop firing**: `integrator` and `final-critic` never ran, wrote nothing and read nothing, and the ending is `stop human`, not the halt at `release-gate` the pre-registration named. These are not defects: `human every 2` is one of the outer loop's stops and it fired where the graph says it should. The pre-registration was written for two pieces; the planner cut three, so round 2 came due before the last piece. **The `ending` list in [`expect.json`](expect.json) should have included `stop human`** — a pre-registration error, recorded rather than edited.
- **One contradicts the template**: "PIECES.md was also written by `summary-card--critic`, not only `planner`". The critic ticking the piece's box in `PIECES.md` is in the critic's brief and its `outputs`; naming `PIECES.md` as the planner's report in `expect.json` made the template's own behaviour a problem. My error, in the expectations, not in the graph.
- **Three are true**: a piece is unticked, `FINAL.md` does not exist, and the final critic judged nothing — all consequences of the first group.

## What the template contributed, and what it cost

Sequential pieces, one owner at a time, each judged on its own against its cut, with the capture check between: that part worked, at $6.95 and 12.6 minutes for two of three pieces. The per-piece dispatch count (owner, capture-check, critic = 3) matches the shape, though **no loop note carried a `cost: {measure: "dispatches"}` field**, so the check could not verify the count against the `started` lines; both loops have dispatch budgets, and the lead tracked them in prose ("8 dispatches", "4 dispatches") instead. The per-round copy of `GAPS.md` was not kept (round 0's was overwritten by round 1's), the same gap the batch-two write-ups name.

## What I would change in the template

1. **The planner must not transcribe the reference.** Its brief should say that a piece's reference cut names *which part of the reference the piece must match*, not what to draw, and that it may not copy values, coordinates or colours out of the reference into `PIECES.md`. Without that line the template defeats its own critic, which is the finding of this run.
2. **The outer human stop needs a `then`, or a longer period.** With `human every 2` and no `then`, a decomposition of more than two pieces always halts mid-way; that is a real brake and may be what a human wants, but the template should say so in its `notFor`, or set `every` from the number of pieces, which a template cannot know. The cheapest fix is a sentence in the description: the run checks in with you after every second piece.
3. **Dispatch counts on the loop notes.** The lead counted in prose; the brief asks for the field. Both loops budget dispatches, so both notes should carry it.

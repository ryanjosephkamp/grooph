# tournament-then-judge · one proving run

**Run** `20260920-190434` · Claude Code 2.1.278 · lead `claude-opus-5`, candidates `claude-sonnet-5` (tier fast), judge `claude-fable-5-1` (tier frontier), finisher `claude-opus-5` (tier strong) · **$2.64** · 335 s wall (the harness reported 4 turns and 28 s for a lead transcript of 47 assistant messages; see below) · evidence in [`run/`](run/) · **`--check` passes**

## Task

[`task/`](task/): `linediff`, a minimal line edit script (`=`, `-`, `+`) with a written contract. `tests/diff.test.mjs` discovers every `candidates/*/diff.mjs` and `src/diff.mjs`, checks each against the contract, and computes the minimal edit count itself, so three different algorithms are judged by one `npm test`. The criteria ([`slots.json`](slots.json)) prefer the clearest passing candidate that stays fast on a few thousand lines.

## Mechanism

A real search space of approaches (LCS table, Myers, patience, greedy with backtracking), not a loop: this template has none. The design bet is ownership and the pick: each candidate writes only under its own folder, nobody else writes there, and the judge's `PICK.md` names one ([`expect.json`](expect.json)).

## Shape

`candidate-a`, `candidate-b`, `candidate-c` (fast, in parallel, each owning `candidates/<x>`) → `filter` check (tests) → `judge` (frontier, sees the finalists) → `finisher` (strong) → `done`. No loop.

## What happened

| step | node | result | record |
|---|---|---|---|
| 1 | candidate-a, -b, -c | dispatched **in parallel** (started 19:04:52, 19:05:02–19:05:09 by the transcripts); all three independently chose Myers' O((N+M)·D) algorithm and wrote `diff.mjs` and `APPROACH.md` under their own folder only | `n-0002`–`n-0007`, [`transcript-digest.json`](run/transcript-digest.json) |
| 2 | filter | the lead ran `npm test`: 40 pass (11 contract cases + 2 per candidate); all three finalists; output saved into the run folder for the judge | `n-0009`, `filter-output.txt` |
| 3 | judge | read the three folders, the filter output, the README and the test file; ran nothing; **`PICK.md`: winner `candidates/b`**, for explaining the two non-obvious Myers steps where they matter and the fastest measured worst case; ruled out c on its self-reported 2.7 s worst case; the idea to borrow from a: its explicit memory-cost statement; flagged b's dead `max === 0` branch | `n-0011`, [`project.diff`](run/project.diff) |
| 4 | finisher | moved b to `src/diff.mjs`, removed the dead branch, added the borrowed note; the lead re-ran `npm test`: 53 pass | `n-0013`, `CHANGES.md` |
| — | done | success, no rounds (no loop) | `n-0014` |

**Ending:** the stop node `done`. Each candidate wrote two files, both under its own folder; nobody else wrote under `candidates/`; `PICK.md` names one winner in so many words ([`result.json`](run/result.json), the `--check` findings). No amendment.

## Did a back edge fire, and what caught it

Not applicable: this template has no loop. Every edge was followed once.

## What the tournament contributed

Three drafts in parallel for the price of three fast dispatches, a filter that let the judge see only working code, and a pick made on the stated criteria with line citations into all three candidates. The search space collapsed on its own (three Myers implementations), so the judge compared quality of the same idea rather than different ideas; the criteria were written to allow that ("prefer the one whose code reads most clearly at its size"), and the pick reads as a code review rather than a coin toss.

## What the lead did that the package did not intend

- **The harness's own numbers are wrong for this run**: `claude-output.json` says `num_turns: 4` and `duration_ms: 27643`, while the lead's transcript holds 47 assistant messages and 31 tool uses, `duration_api_ms` is 468 s and the wall was 335 s. The other runs of this batch report plausible turn counts; the difference here is three subagents dispatched in one message. A harness reporting quirk, recorded as found.
- Zero permission denials: the first run in either batch with none.
- Candidate notes carry `cost: {measure: "tokens"}` and no `text`; two timestamps are out of append order because the three parallel candidates' notes were written when each finished.

## What I would change in the template

Nothing from this run. If a future tournament wants genuinely different approaches, the task text should ask each candidate for one by name (the template's "an approach different from the obvious one is welcome" was not enough to move three fast models off Myers).

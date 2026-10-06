# The fresh reader's report on the reconciliation's judgments

**From:** one fresh reader (Claude Code subagent, Opus 5.5, read-only, no context of the audit) · **Date:** 2026-10-06 · **Read:** `HANDBACK.md` and `RECONCILE.md` as they stood at commit `2b575eea`

It arrived after work had stopped for the owner's absence. **It refutes two things `RECONCILE.md` says** (its items 1 and 2), and they are not yet corrected there. Its own probes and what they printed are beside this file, as it left them; paths inside them point at the session's scratch folder. The report is given as written, with `S` standing for that folder.

## Findings, most serious first

1. **C(i), lines 22 and 191 (Card 1): the F1 edge is false at main.** A new leading-on stop of a kind the loop lacked is adopted where no check or critic stands before its destination. A worker-and-sorter loop holding only `budget:dispatches 2` (halts); the copy adds `max-iterations 1 then done` ahead: `grooph adopt --write` exit 0, "WROTE the copy", labeled "tightens"; `grooph export --into` exit 0, "none of the brakes it compares was removed or loosened" (S/variants4.mjs, variants4.txt case 1). Cause: `looser` walks only the kinds the source had (packages/core/src/brakes.ts:125). The lane's refusals came from the reach rule ("a way that does not pass the check"), which its probe never printed: stop-added-ahead-probe.mjs:42 reads `r.reasons`, the field is `loosens`. Change: strike "the source must already hold both stops" and Card 1's "It does notice a new limit being added"; widen correction 1 and the repair to stops of different kinds, new ones included (docs/templates.md:67 says it is held).

2. **B, F2 (lines 24, 55; correction 2; Card 2): "only adds, cannot hide a run that went past" is not true of the counter.** Dispatch, check, then `awk 'BEGIN{system("node check/fixed-fail.mjs")}'` (really run): 3 real node runs at budget 2, counted 2, `met`; likewise 8 real at budget 6 (S/counter.mjs, counter.txt). `ONLY_PRINTS` lists awk, sed, git (scripts/lib/brake-count.mjs:318); the run is filed as printed back (:403), which no verdict reads. A real check whose command holds the marker turns an overrun into `not judged` (:402). In prose form one replayed line turns dispatch, check, dispatch into `met`. What holds: for a pure replay in package form every overrun term before :525 only grows. Change: mark F2 "agree"; make the note and the repair two-sided; strike Card 2's "It cannot".

3. **A, F4 (correction 5): Codex's "only reviewers were authorized" went unchallenged.** experiments/comparisons/review-gate-2/A-1/package/agents/layer-settings--builder.md:20 lists the held-out suite under "## Inputs"; :36 says "You may inspect ... your declared inputs". The file grants and forbids; the new sentence should say so.

4. **A, F3 (corrections 3, 4; Card 3):** Codex's sentence names the suites' measure and not the judges'. experiments/comparisons/README.md:102: "The judge is given what the builder saw, not the suite". Add "given only the visible task".

5. **D, correction 13.** templates.md:64's new words still say the comparison "is not got round ... under a new id"; docs/runs.md:75 lists "the same stop under another id" as adopted. graph-ir.md:192's "is told to put it to the person first" is true of export only (packages/cli/src/commands/export.ts:542); adopt's refusal prints the ready `--allow` command. Its "refuses a working copy that has loosened one" is what F1 refutes; use Codex's "changes its comparison flags".

6. **E, missing cards.** Decision 0029 point 6 (line 40) holds adopt's refusal "claimed nowhere as shown" until a second harness reads the comparison; one now has. Whether that lifts is the owner's. "Beside the sixteen" promises a 0029 clarification with no words and no card.

7. **E, third round.** Card 6 ties study two to a round whose prompt does not read it, while line 239 says it needs none. "Nothing is disputed" holds for Codex's sixteen, not for the lane's own two edges (items 1, 2); put both in the round-three prompt. The export comparison (export.ts, about 500 lines changed since the snapshot) and #127 stay unread by Codex and outside "three things only".

8. **D and B, smaller.** Correction 9 drops Codex's "of selected parts" unexplained; 11 drops "and the run ID"; 6 says "nearly all", then "a little more than the whole"; in 15 three steps were unreached, not two (integrator, final-critic, release-gate). F8's "partly" changes nothing: Card 4A is Codex's ask.

9. **F, unanswered:** metric-sandwich ("no loss detected", not "harmless"); 60 of 110 reader receipts differing; the registrations' push time; "one sentence" against five substituted lines.

## Sound

C(ii): in all 26 loops no leading-on stop sits behind a halting one, and a new non-person leading-on stop ahead of the first halting limit was refused in every template loop but `debate`, whose cap already leads on first (S/templates.txt). F1 reproduces, equal and mixed. Refused, as claimed: same-kind additions, a changed `then` or kind, a second loop, critic loops (S/variants.txt, variants3.txt). Correction 10 matches validate.ts:641; in 12 the judge is also handed the filter's output.

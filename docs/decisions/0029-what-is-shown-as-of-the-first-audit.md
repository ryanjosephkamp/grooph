# 0029 · What grooph is shown to do, as of the first audit

**Date:** 2026-10-05 · **Status:** accepted (the owner, 2026-10-05: on the review desk, "Accept all seven as recommended"; in the driver's session, "The audit's corrections seem reasonable". Drafted by the audit lane; signed as drafted) · **Deciders:** owner

## Context

Decision 0013 fixed one sentence for every page: grooph "is shown to bound and record autonomous work and to hold a design as a runtime contract; it is not shown to raise quality over the same instructions given as a prompt, on small tasks."

Decision 0024 then required that a claim be read by a second harness before it is published. The first audit ([`experiments/audits/0001-claims-as-of-0-3-0/`](../../experiments/audits/0001-claims-as-of-0-3-0/README.md)) read all 52 claims grooph made at 0.3.0. Claude Code and Codex, reading separately, came to the same reading of each. Of the sentence above, both found that "bound" is not carried by the records, and that "record" and "contract" are carried by something narrower than the words say.

A second comparison ran on 2026-10-04 and is in the repository. Its claims have not been through an audit.

## What is shown

- **A run stops where its graph says.** In the twenty kept proving records and the nine package runs of the first comparison, every run ended at a passed bar, at a stop the graph names, or at a human gate. Fourteen halts at a human gate are on record, and one at a periodic human check-in.
- **A run leaves a record.** Every recorded run left its notes, its progress file and its working copy of the graph. Some records omit fields the package asks for.
- **A session followed its package**, by the project's own checks of selected parts of each record, in eighteen of the twenty kept records. The two that did not are published red.
- **No quality advantage over a prompt derived from the same package**, on four small tasks. None of the four projects met its pre-registered test for the graph earning its cost.
- **Two mechanisms, once each.** Two templates record a critic sending work back on reference evidence the builder was instructed not to read.

## What is not shown

- **That a round cap or a budget holds a run that would otherwise go on.** None is on record as firing: not in the 33 package runs at 0.3.0, and, by its own handback, not in the 24 runs of the second comparison. The first comparison's one run that was cut off was a prompt run inside the same caps the graph has, ended by the runner's dollar ceiling.
- **That grooph enforces anything while a session runs.** The validator checks a document. The package instructs a session. At 0.3.0, adopting a run's working copy showed a person what changed and refused nothing. Since 2026-10-05 the `grooph adopt` command does not write a working copy that loosens a brake its comparison sees, until the change is asked for by name: a check at one door, after a run and not during it, not made by the web app's button, and not yet read by a second harness.
  - *Note, 2026-10-05, added the afternoon this was signed:* the clause "not made by the web app's button" was already untrue when the decision was signed. Since pull request #117, merged twelve minutes before, the web app's Adopt button makes the same comparison: it saves nothing when a brake is loosened, and offers no way to say yes. The text above is left as signed.
- **That the package and a prompt are equal in quality.** Three of the four test suites were saturated and replicates were two or three.
- **What a correction or a brake is worth.**

## Decision

1. **The sentence, everywhere it stands** (the README's status, the front page, the field guide, the report, the design skill and the status skill): "Each of the twenty templates has a recorded run: eighteen pass the project's checks and two are published red. In those runs a session stopped where its graph said, at a passed bar or at a human gate, and left a record of what it did. No round cap or budget is on record as firing, so it is not shown that one holds a run that would otherwise go on. In a paired comparison on four small tasks the package showed no quality advantage over a prompt derived from it."
2. **"Bound" is not said of grooph** until a record shows a brake binding and that record has been audited. The experiment that would make such a record is pre-registered and built, and not run ([`experiments/brakes/budget/`](../../experiments/brakes/budget/README.md), from the design in [`a-brake-that-binds.md`](../../experiments/audits/0001-claims-as-of-0-3-0/designs/a-brake-that-binds.md)).
3. **The second comparison exists and is not yet audited.** No page states its results as shown until a second harness has read them. When they are stated, one distinction is kept: no graph earned its cost over the same design said as prose; what ended above the task alone was the design, in either form.
4. **Decisions 0012 and 0013 stay as they were written.** Three of their statements are corrected here and not there:
   - "No loop turned in 27 runs": one correction cycle did turn, in a prompt run.
   - "The only run in study one that went past its bounds was a prompt arm running to the dollar ceiling": that run was inside the graph's caps, and the ceiling was the runner's.
   - "Back edges fired in six templates once tasks carried held-out evidence": six records show a returning edge; two of them are a critic's correction on held-out evidence.
5. **Every public claim is listed** in [`docs/claims.md`](../claims.md), with where it is made, its evidence, and where its audit stands.
6. **What `grooph adopt` refuses is described where the command is documented, and is claimed nowhere as shown** until a second harness has read the comparison it rests on (`packages/core/src/brakes.ts`). By its author's account, five readers in turn have each found a loosened graph that comparison let through; each is closed, and the list of what a brake is has not been shown complete. At this date the comparison does not hold a check's command or where its verdicts lead; amendment A-019 (2026-10-05) makes them brakes, and the code follows it.

## Consequences

- The corrections of the audit's first round are made as the owner accepts them, by number. He accepted all seven of the audit's decisions on 2026-10-05, and the corrections were merged that day (pull request #105; the two that live in code and templates in #108).
- Decision 0013's fifth point said that if a second study also found no quality advantage, grooph would be repositioned "around bounded autonomy and the record". Bounding is what is not yet shown. That point is the owner's to restate once the second comparison has been audited and the brake experiment has run or been declined.
- The words of the design skill and of the status skill follow point 1; they are not in the audit lane's pull request.

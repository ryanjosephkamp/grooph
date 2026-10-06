# Audit 0001-claims-as-of-0-3-0 · round 02 · handback from Codex

**From:** Codex (GPT-6.1 Sol) · **To:** the audit lane (Claude Code) · **Date:** 2026-10-06 · **Commit read:** `faba78aeff36e9aca5c02c8e726086cbe10191f5` · **Changed anything:** no, in the snapshot or grooph repository. Only this exchange folder was written.

The four-file cost-page overlay is read at the handoff's `980bcb6`, separately from that commit. All paths below, except `notes/`, refer to the supplied snapshot. Probe receipts and coverage details are in [notes/AUDIT-NOTES.md](notes/AUDIT-NOTES.md).

## Verdict in one paragraph

The central correction stands: these records show prescribed endings and partial records, not that a numeric brake binds continuing work or that grooph enforces a running session. Study one's corrected account is substantially sound. Study two meets all three registered A-versus-B losing conditions; its scores support a sentence about the author's hidden suites, not a general quality advantage over the task alone or an isolated benefit of structure. Adoption now has a real, overridable refusal at named doors, with material gaps: I obtained a valid working copy through the CLI without `--allow` by changing only the order of two simultaneous budget stops, turning the prescribed halt into success. The parked budget pair preserves the intended experiment, but its counter can count replayed output as a check execution and return `met`; that evidence predicate needs correction before a passing result could support a claim. Decision 0029 preserves the important withdrawals, with the qualifications below. The five requested guide chapters need further wording corrections before publication. No model session or new experiment was started.

## Findings

### F1 · Stop order can turn a halt into success without a refusal

- **Claim:** Part E, the requested new road through adoption; A4, corrections 7 and 20; stop precedence in `docs/graph-ir.md` §2.
- **Severity:** blocks an unqualified claim that the comparison holds the graph's brakes; does not refute the deliberately qualified phrase “a brake its comparison sees.”
- **What I read or ran:** `brakes.ts`, `reach.ts`, `adoption.ts`, the CLI, and [notes/stop-order-probe.mjs](notes/stop-order-probe.mjs). Its [receipt](notes/stop-order-probe.txt) shows both graphs validate for export, `loop:work.stops` is neutral, nothing is refused, and CLI adoption writes version 2, exit 0, without `--allow`.
- **The problem:** The source has a budget of 2 dispatches that halts, followed by an equal budget of 2 whose `then` reaches a success stop. The working copy reverses those two entries, changing nothing else. The contract says the first firing stop wins. At the same count, the source prescribes halt and the copy prescribes success. `brakesOf` reduces stops to minima and sets; `looser` treats equal thresholds as though a continuing stop were already first. It loses document order. This is a missed aspect of an existing brake, not a request to add an unrelated kind of brake. It is separate from changing a stop node's `outcome`.
- **What would change my mind:** A refusal for this valid CLI case, and comparisons that preserve precedence when equal or differently measured stops can fire together. A rule that forbids this graph would also need a validator error and a contract change; it is legal now.
- **What I would publish instead:** “The comparison flags selected changes to brakes. It also misses a reordering of simultaneous stops that changes halt to success.” Add this to the limits before claiming the comparison's coverage. This probe establishes prescribed behavior and adoption, not a live session's choice.

### F2 · The budget counter can accept a check that never executed

- **Claim:** Part D, “counted from its own trace”; `experiments/brakes/budget/README.md`, “no other program prints” the check's line; `brake-count.mjs`'s `met` predicate.
- **Severity:** blocks the claim that the counter independently establishes check executions.
- **What I read or ran:** The pre-registration, `brake-count.mjs`, its 28 passing tests, and [notes/counter-replay-probe.mjs](notes/counter-replay-probe.mjs). The [receipt](notes/counter-replay-probe.txt) includes an actually executed, model-free command that decodes and prints the marker. It executes no check. `addCheckLines` and `nodeRuns` count it as one check; with otherwise conforming synthetic facts, `judge` returns `met`.
- **The problem:** A marker in output is evidence of a printed line, not proof of its producer. The defenses catch a literal marker in the command and familiar printing commands, but a `node -e` command with the marker encoded passes both. Reprinting a prior log through a helper is the same kind of problem. The runner's later checksum and its own fixed-fail invocation establish neither that this check ran earlier nor how often. This is a synthetic parser counterexample, not an allegation about any recorded lead.
- **What would change my mind:** The parser treats unproven producers as `not judged`, or an independent execution trace identifies each invocation. A regression receipt should show that replay and helper-produced markers cannot produce `met`. An unknown command being manually read is a valid conservative outcome.
- **What I would publish instead:** “The counter counts recognized check-output lines and dispatch records, with attribution limits. A passing pair requires review of the underlying executions.” Do not use an automated `met` alone as evidence that a budget bound a run.

### F3 · “Ended above the task alone” must name the measure

- **Claim:** S3 and the candidate study-two sentence; decision 0029, point 3.
- **Severity:** blocks the candidate sentence as a general quality or structure-benefit claim.
- **What I read or ran:** All 24 `score.json`/`result.json` pairs, the three tasks and their suite descriptions, D prompts, judge mappings and verdicts, and the independently re-derived summary. A/B/C score 55, 70 and 24; D scores 51, 52 and 15, in both replicates. The two code-project judges rank both D runs ahead of the review arms.
- **The problem:** The hidden suites settle choices absent from the visible task, and sometimes choices a literal reader disputes. For example, the settings judge favors D's interpretation of an `undefined` value while the suite requires another. Calling that judge unusable as a quality ranking does not establish the suite as the unique quality measure. Review arms receive feedback carrying those hidden choices; D does not. Their configurations and builder models also differ. Higher suite scores establish that result, not a causal benefit of the graph, structure, or independent review alone.
- **What would change my mind:** A pre-registered, comparable-information control and an independently accepted quality measure for the task. Nothing further is needed to report the existing scores accurately.
- **What I would publish instead:** “On three small tasks designed to need feedback, the package and both prose review arms scored higher than the task-only arm on the author's hidden suites or reference checks, in both replicates. The package and prose arms matched on those scores, and the package cost more than single-session prose. The code-project judges ranked task-only outputs higher. This did not isolate the effect of structure from the extra evidence.”

### F4 · The cost page's held-out table misstates the builder's declared inputs

- **Claim:** S5 and S7, `lead-cost.md`, “Who was given what”: held-out material “Named to the reviewer only.”
- **Severity:** weakens the account of information separation.
- **What I read or ran:** The six A source graphs, builder/owner agent files, working copies, and the context scan. [notes/builder-declared-evidence.json](notes/builder-declared-evidence.json) records the comparison.
- **The problem:** All six compiled A builder/owner files name the held-out path in declared inputs, along with the instruction not to read it. Three leads remove it from their working graph's builder inputs; three do not. A scan of dispatch prompts is not a scan of a named agent's standing file. These facts do not show that a builder read the hidden material, but “named to the reviewer only” is false as a literal description of what was provided. The absence of a directly named path in tool calls does not rule out aliases or indirect disclosure either.
- **What would change my mind:** Distinguish source inputs, amendments, standing agent instructions, dispatch prompts and observed reads. Actual evidence of reads would be needed to claim leakage; I found none in the named-path scan.
- **What I would publish instead:** “Only reviewers were authorized to read the held-out material. A's compiled builder inputs also named its path and prohibited reading it; three leads removed that input from their working graphs. The scan found no direct builder read naming that path. Access was constrained by instruction.”

### F5 · The cost allocation is useful, but it does not price the causal cost of recording

- **Claim:** S7, “all of it is the lead,” “nothing tells the lead to read,” and “It prices the record”; C51.
- **Severity:** weakens causal wording; the main arithmetic stands.
- **What I read or ran:** All four overlay files; the nine tests; `compare-lead.mjs --check`; a re-derivation from the original transcripts; and independent grouping of raw usage by assistant message ID. [notes/independent-study.json](notes/independent-study.json) gives A lead $0.838481 versus B $0.314307. The lead difference is $0.524174; subagents differ by −$0.007904, so the whole-run difference is about $0.516270.
- **The problem:** Nearly all of the mean difference is in the lead, not literally all; subagent differences matter by project. Filing a mixed-purpose call once and allocating newly cached tokens by returned characters are accounting assumptions, not measured marginal costs of removing a file or a note. A and B differ in more than recording. The brief also asks dispatch prompts to carry declared inputs located in the graph or agent files: there is an implicit reason to inspect them even without an explicit “read” command. The page's “It prices the record” exceeds C51's correction that recording was not isolated.
- **What would change my mind:** A controlled change that removes only recording, keeping other instructions and access equal, could estimate its causal cost. Token attribution alone cannot do that. No new run is needed to publish the present descriptive accounting.
- **What I would publish instead:** “Nearly all of the mean cost difference lies in the lead. Under the stated allocation rules, substantial lead cost falls in package-reading and record-writing calls. This does not isolate the marginal cost of the record or establish savings from removing those calls.” Replace “unasked” with “not explicitly requested; some information needed for dispatch is in those files.”

### F6 · Repair cycles are recorded; measured improvement is less broadly evidenced

- **Claim:** S2.
- **Severity:** wording, especially if “changed” is read as measured improvement or causal benefit.
- **What I read or ran:** Six A notes and round reports; B/C derived records and the original-transcript inventory. I reconstructed the two preserved round-0 trees in this folder and ran the existing suites: [44/55](notes/review-gate-2-round-zero.txt) and [52/70](notes/heterogeneous-critic-round-zero.txt), as reported.
- **The problem:** Those two trees establish measured before/after differences. Other code-project first-pass counts are reported or transcript-derived; taste has no numerical first-pass score. Four agent dispatches per run and the reports support a repair cycle in all 18 review runs. They do not give 18 independently preserved first-pass scores or isolate the cycle's causal value. The author's intentionally incomplete task information is a plausible explanation of what the cycle repairs.
- **What would change my mind:** Preserved first-pass artifacts re-scored with the same final scorer, and a control separating feedback information from the review arrangement, for stronger claims. Existing receipts already support a careful cycle description.
- **What I would publish instead:** “All 18 review-arm records show a second builder/reviewer pass after reported first-pass gaps. Two preserved first-pass trees independently re-score below their final results. Other first-pass counts are reports or transcript derivations, and taste has no first-pass count.”

### F7 · Human gates are brakes and did fire

- **Claim:** S4 and the last sentence of the study-two candidate.
- **Severity:** wording; “No brake fired” is false under the project's own definition.
- **What I read or ran:** The stop scan, A notes and the study handback. The four A code-project runs halt at their merge gates. The newer Gauntlet proving run also records a periodic human stop, outside the comparison.
- **The problem:** “No brake” erases the observed human gates that A-008 and the guide expressly call brakes. What remains unobserved is the numeric limit firing, not every brake. This distinction matters to the withdrawal of “bound.”
- **What would change my mind:** A definition that excludes human gates would conflict with the present contract. The smaller sentence needs no further evidence.
- **What I would publish instead:** “No round cap or budget is recorded as firing in the comparison; four package runs halted at human merge gates.” If discussing periodic check-ins too, explicitly say none fired in the comparison.

### F8 · “Eighteen of twenty” is a latest-run denominator

- **Claim:** A1, corrections 1, 3, 5, 8 and 12; S10; decision 0029; guide chapter 13.
- **Severity:** wording, material to interpreting the success count.
- **What I read or ran:** Field guide, proving index and historical runs, plus current `run/result.json` files. Twenty latest runs cost $41.116289. Seven earlier records in six templates remain, six with failing checks.
- **The problem:** The selected latest record of each template is a legitimate denominator, but the short status does not identify it. “Two are published red” can imply only two retained failures exist. Re-running a template changes the selected denominator without erasing its earlier failures. “A record of what it did” is fair ordinary language if read as the lead's account; it should not imply a complete, independently reconstructed trace.
- **What would change my mind:** Name the selection rule and retained earlier records where the headline count is stated. No new experiment is necessary.
- **What I would publish instead:** “The latest kept run of each of twenty templates is counted: eighteen pass the project's checks of selected parts, and two fail. Seven earlier runs are also retained, six with failing checks. The counted runs ended at graph-prescribed points and left lead-authored records, some incomplete.” Gauntlet's lawful halt does not make the ending claim false; see F16.

### F9 · A loop with no cap need not draw the promised warning

- **Claim:** A2, correction 2; A4, correction 6.
- **Severity:** wording.
- **What I read or ran:** `W_LONG_LOOP_NO_BUDGET` and [notes/entry-and-warning-probe.txt](notes/entry-and-warning-probe.txt). Removing the cap while retaining a budget produces no warning.
- **The problem:** The rule warns when there is no budget and there is no cap or the cap exceeds five. “Warns when a loop has no cap” drops a condition and describes a class the validator does not always flag.
- **What would change my mind:** A rule that actually warns on every capless loop, with its fixture. That would be a product change, not the present correction.
- **What I would publish instead:** “It warns when a loop has no budget and lacks a cap or allows more than five rounds.” Use that wording in the front page and report table.

### F10 · An answer enables continuation; it does not automatically resume the session

- **Claim:** A2, correction 2, “A halted run goes on when a person answers”; C47.
- **Severity:** wording.
- **What I read or ran:** Corrected graph/run documents and the retained scripted or owner-approved resumes.
- **The problem:** The observed continuations resume the same harness session and supply the answer. A person answering somewhere is not itself a grooph continuation mechanism. The current short sentence can promise automatic continuation or a run ID as a sufficient resume mechanism.
- **What would change my mind:** An implemented, observed answer-to-resume mechanism. The existing records already support the instruction below.
- **What I would publish instead:** “To continue a halted run, resume the same harness session with the person's answer and the run ID.”

### F11 · Three current surfaces still carry unsupported promises

- **Claim:** A4, correction 18/C50; correction 22/C46 and the explicit question about descriptions left unchanged.
- **Severity:** wording.
- **What I read or ran:** `Landing.tsx:63` still says “Works on a phone”; report §2 still says the graph is “small enough for a model to read and rewrite in one pass”; the two descriptions named by the handoff still say “sees only” or “never sees.”
- **The problem:** README's device wording was corrected but the front-page badge was not. Native phone/Safari evidence remains absent. A character warning is a design target, not a measurement of successful model rewriting. The access descriptions again turn instructions into guaranteed information exclusion. Raising a template version records a behavior-affecting edit; it does not make the old guarantee supportable while waiting.
- **What would change my mind:** Native evidence for a scoped device claim, an actual rewrite measure, or enforced/observed exclusion for the claimed access boundary. Wording fixes need none of these.
- **What I would publish instead:** “Built for a phone's screen”; “designed to be small, with a warning above 24,000 canonical characters, excluding layout”; “the builder/proposer is instructed not to read that material.” Correct the live descriptions in the next authorized version; preserve frozen experimental inputs and historical evidence, with an adjacent qualification meanwhile.

### F12 · The requester at adoption is not necessarily a person, and coverage is selective

- **Claim:** A4, corrections 7 and 20; C45; part E's candidate, verb and help text; `docs/templates.md`'s categorical refresh account.
- **Severity:** wording.
- **What I read or ran:** All named comparison/adoption source files, the app's check component, the nine named probes and the eight-reader suite. Cap/budget increases are refused; my explicit `--allow loop:review.stops` writes them. The known new-stop, already-reached, halt-to-success, free-text budget and export cases reproduce.
- **The problem:** Graph-ir says adoption refuses until “the person asks,” although any invoker can provide the name. C45's “holds … where its verdicts lead” sounds broader than the held changes to a check's definition/outgoing edges and selected bypasses. A refresh's whole-graph comparison does not prove a brake cannot be shed across two changes or new IDs. Stop order adds another limit. CLI help should say a **loop budget stop**, distinguishing it from `constraints.budget`. App refusal and command override are different interfaces.
- **What would change my mind:** Authentication or another enforced person-only approval boundary; complete coverage evidence for categorical wording. Neither exists at this snapshot.
- **What I would publish instead:** “The command refuses changes its comparison flags until its invoker allows the named changes; an agent can do this. The app refuses them and offers no override. Refresh uses the same comparison. Export does not compare brakes. Coverage is incomplete, and nothing enforces these instructions during a run.” “Refuses” is an honest verb with those conditions; being told how to override does not erase the refusal.

### F13 · The prose brake control permits a different amount of work

- **Claim:** S8; part D, “same budgets as prose” and when the package “earns something.”
- **Severity:** weakens the comparative interpretation; does not invalidate the primary package pair.
- **What I read or ran:** Derivation rule and prompts, compiled loop definitions, `expect.json`, and `brake-count.mjs`'s prose predicate. `brake-run.mjs --check` confirms the frozen prompts.
- **The problem:** Prose omits that checks count as dispatches. Its judge accepts either N node runs or N builder dispatches plus N checks. A prose run at budget 2 may therefore make four node runs and pass, while the identical package count fails. This is a pre-registered ambiguity test, not equal budget treatment. “No budget fired, so it changed no result” is too strong counterfactually; there was no observed budget firing, but a stated limit can influence decisions before it fires. S7's four dispatches also means four **Agent calls**; taste has six counted loop node runs.
- **What would change my mind:** An explicitly identical counting unit in both arms for an equal-budget comparison, adopted prospectively by the owner. Keep already frozen prompts and label the ambiguity if they are the treatment being tested.
- **What I would publish instead:** “The primary pair tests package obedience at two node-run budgets. The prose pair separately tests two possible readings of the derived wording; its accepted workloads differ. It cannot establish that the package enforces the same budget better.” Future derivation should carry the unit definition if that is the intended comparison.

### F14 · Contradictory examples and unsettled round semantics limit what a brake run can show

- **Claim:** S9, S10 and part D's compiled brief.
- **Severity:** weakens interpretation of the planned test; wording for the current guide.
- **What I read or ran:** Compiler's fixed round-3 example, both compiled budget packages, pre-registration and patterns test sizing. The dry run finds five changed package lines, all budget substitutions; the prose prompts differ in one line.
- **The problem:** The small brief's budget-2 example cannot describe the registered one-round boundary. For budget 6, “round 3” is also contradictory if the note names the round just completed. Max-iterations likewise leaves four passes versus four returns insufficiently settled. The round-0 numbering and budget covering five rounds do not resolve that. The primary 2/6 pair avoids a binding round cap, but a failure could be a response to conflicting instructions, not failure of an unambiguous budget. “Three statements against one, so unlikely” is a design guess, not evidence.
- **What would change my mind:** Unambiguous normative definitions and examples, versioned before the relevant treatment is frozen. A future round-cap experiment needs that definition first.
- **What I would publish instead:** “This tests the current compiled brief, including its contradictory example. An overrun is still a failed outcome; its cause is not isolated. A success would show the lead followed the numerical budget despite that example, once.” Preserve the frozen packages; do not repair them retrospectively to obtain a pass.

### F15 · “Empty context” and “nothing watches” misteach the runtime boundary

- **Claim:** Part F, chapters 1 and 13; chapter 1's force table and subagent explanation.
- **Severity:** wording, with a material information-isolation implication.
- **What I read or ran:** All five requested chapters, the subagents document's harness distinctions, compiled agent files and observation documentation. No new subagent was started.
- **The problem:** A helper is not literally empty or limited to what the lead hands it: standing agent/harness/project instructions and readable files matter. A fresh worker can omit the parent's conversation; forks and resumed workers are different cases. The local Codex account in `docs/subagents.md` specifically describes inherited context as the default for its exposed interface. “Nothing in grooph watches” is also literally false of `grooph watch`, hooks and the live view. Their observation does not enforce a decision, and that is the needed distinction.
- **What would change my mind:** Scope a demonstrated context boundary to a particular harness and dispatch mode. No such universal boundary is evidenced here. Observation versus enforcement is already supported by the code.
- **What I would publish instead:** “A fresh worker can start without the parent's conversation, but receives its own instructions and can read permitted files. The lead is instructed how to hand it evidence. grooph can observe recorded events and notes while a run proceeds; it does not control or stop the run.” Make the same distinction in the guide's start-page sentence about work beginning again only after agents finish.

### F16 · The guide turns Gauntlet's lawful halt into a contract failure

- **Claim:** Part F, chapter 13's explanation of the two red records; A1's specific question.
- **Severity:** wording, material to a beginner's interpretation of the failure count.
- **What I read or ran:** The latest Gauntlet write-up and notes, its expected ending, the field guide, and chapter 13.
- **The problem:** “A step that should have been its own subagent never ran as one” suggests the lead did that work itself or skipped a required step. The integrator/final critic had not been reached when a prescribed periodic human stop fired. Eight reported problems are consequences of that legal halt. One concerns the amendment patch not reproducing the working copy, a real record defect; another concerns the checker counting an inner loop differently from the brief. The guide should not collapse these into noncompliance. Also, “keep the whole record” is stronger than the exported/scrubbed record plus the selected-part checks it explains later.
- **What would change my mind:** Evidence that the omitted downstream work was reached and performed incorrectly, rather than not yet reached. The current write-up says the opposite.
- **What I would publish instead:** “Gauntlet halted where its human stop required, before downstream steps. Its check still fails: several expectations assume those later steps ran, and its amendment record has a real replay defect. Ralph separately violated the instruction not to read held-out evidence. Records are retained with these distinctions, not treated as complete reconstructions.”

## What I checked and found sound

**Study one and the corrections.** Report §5.2 now correctly distinguishes three losing conditions from `review-gate` meeting neither, 61/62 from saturation, the prompt run's correction cycle from A's round-0 endings, and an outer dollar cutoff from graph limits. It describes a package against prose derived by rule and the additional configuration differences. “No demonstrated quality advantage” is carried; equivalence is not. The corrected hook description, sender qualifications, reported-observation labels, quickstart quantifiers and “may catch different mistakes” are substantial improvements. The unchanged first-round evidence and dated corrections should stay intact.

**S1 and registration.** All three A/B losing conditions hold replicate by replicate. The primary task/held-out/registration files I compared, 31 files across the three projects, match the last pre-run commit `d6178de5`; each README's pre-registration portion also matches. The earlier registration corrections and owner tier-map commit precede the first invocation. Local commit/history and transcript times support the order; they do not independently timestamp the claimed push to the remote. The first raw assistant timestamp I found is `2026-10-04T21:14:37.827Z`. The 24 run costs total $20.794725; three judge records total $1.2365226; $22.03 is right when rounded.

**S5 and S6, within the scan's limits.** The authorized raw-transcript scan finds all 24 runs and 96 transcripts. In the 66 B/C/D transcripts it finds no tool name. All 79 directly named held-out tool accesses are critics'. The 36 builder dispatch prompts do not name the held-out folder; the three commands mentioning “held-out” without its path write their own repair accounts. These are scoped negative observations, not proof of complete access exclusion or absent skill loading. C made one iteration in each of six runs; the two code judges favor both D candidates. The proving ledger's $62.68/35 invocations and the newer patrol pass are consistent with the retained summaries.

**S7 arithmetic and rates.** The nine tests and table check pass. Raw usage grouped independently by assistant message ID reproduces the lead's three component differences: read/input about $0.178982, cache addition $0.183032, output $0.162160. The Opus equations have rank five and identify the five coefficients uniquely under the exact linear model at saved precision: 4, 20, 0.20, 8 and 5 dollars per million in the script's column order. This identifies an internal accounting fit, not an official price schedule. Sonnet's one-hour column is zero and unidentifiable; two rows have the acknowledged small residual. The qualified setup/cycle split and 20/100-dispatch projections are acceptable as explicitly stated arithmetic, not measurements or forecasts. The file split by characters has no independent causal validation. “About a sixth, not a half” is acceptable for the specified removal model, including its upper-bound and unbuilt-work qualifications.

**Adoption and the new irreversible-entry fix.** The nine handoff probes reproduce the intended refusals and acknowledged openings. The original shell adoption probe does not actually run its advertised override case; I ran it separately and confirmed exit 0 and a written file with the named override. The six pure-probe results matter more than stale explanatory prose: `irreversible-entry-probe.mjs` still prints an old concluding sentence despite now printing the new error. My additional entry, nested-loop and stop-`then` cases raise `E_IRREVERSIBLE_NO_GATE`. This supports the fix for those declared routes, not a proof of every possible route. Ninety-eight selected adoption, refresh and CLI run tests pass. The app uses the same comparison and fails closed by source inspection; I did not operate the native app.

**The retained eight-reader scripts.** I ran the full suite, including its longer seeded probes, using an exchange-local wrapper that directs `TMPDIR`, scratch and all 110 output files here. Fifty outputs exactly match saved receipts; sixty differ. Additions to the fixture pool, changed refusal coverage/wording, path formatting and timing account for inspected differences; old receipts are not current goldens. Current check enumeration reports 3,209 valid cases with no holes under its own oracle; CLI/core consistency has zero disagreements across 374 valid copies. Other oracles still report known gate/round limits. A probe's oracle is not a complete contract proof. The [comparison](notes/reader-output-comparison.json) preserves every difference for review.

**The author's E questions, in order.**

1. **Starts.** The unmodified Gauntlet has `planner` as its sole start under both rules. Remove the ordinary incoming edge to `integrator`, leaving the outer stop's `then`: graph-ir still starts at `planner`, while comparison starts also at `integrator`. It then wrongly explains that the run “would start there.” A-019 separately holds removal of the edge leaving `next-piece`, so this case is still refused for a legitimate independent reason. The narrower rule better describes the contract; I cannot certify its global safety from these probes. Local-from-every-node comparisons also matter: my attempted minimal bar-stop bypass was refused, despite the wider source start masking the global reach difference. I do not report it as a hole.
2. **An answer gains another already-reached destination.** Reach-set equality does not preserve the meaning of that answer. Keep this as a named limitation, including new destinations; do not imply gate-answer semantics are completely held.
3. **A critic loses all verdict routes.** Core results do not establish exportable graph validity. The CLI's validation is a real additional barrier. Prefer an explicit invalid-result status or hold where appropriate, but distinguish missing progress routes from a route that permits success without approval. “Core returned it” alone does not show the CLI wrote it.
4. **A person opens an uncounted lap.** The printed notice is necessary and the owner's choice is coherent: a new explicit decision can authorize further work. A periodic human stop with a huge `every` is not an approval on every ordinary traversal. Reach abstractions do not prove when that stop fires. A one-answer gate still requests a decision but offers no refusal choice. These are semantic limits to describe, not evidence that the numeric cap bounds the entire run.
5. **New IDs.** Holding removals is a defensible conservative rule. The allowance is an explicit change-name override, with no identity proof and possibly broad effects. Honest renames and some tightenings costing an override are real costs; do not advertise them as measured user acceptance or safety benefits.
6. **An emptied brief/shell loop.** Keeping old steps and moving work into new steps escapes structural identity checks. Semantic equivalence of briefs and commands is outside this comparison. Keep the limitation; do not repair it with a claim that a whole-graph comparison proves it impossible.

**The check exceptions.** The approval exception only adds a person on the same edge. The evidence exception requires the same existing critic endpoint and a superset of the same evidence strings, and is denied when another comparison loss is attached to that name. This is materially narrower than the rejected “whatever tightens” rule. It preserves those structural properties; arbitrary evidence text is not guaranteed to improve independence or quality. Refusing an honest outgoing-edge change unless allowed is deliberate conservative behavior, not a bug proven by inconvenience.

**The one `metric-sandwich` case.** A minimal incoming-edge change to `when: fail` refreshes with no held change and no validation error in my [receipt](notes/metric-and-starts-probe.txt). That supports the limited present-code observation. It does not show the check will run on the successful builder's route, nor that the package's behavior is unchanged. A conditional incoming route is not automatically a bypass of a verdict: it can prevent progress instead. I do not treat this minimal case as a new loosened-brake finding. The handoff does not give the complete compound mutation of the one historical 16,243-case comparison, so I have not independently attributed that older refusal's cause. “No loss detected” is safe; “proved harmless” is not.

**Part C.** Decision 0029 is faithful to the central first-round withdrawal, and preserves the three historical corrections rather than rewriting evidence. Retain its dated app note and add dated clarification for its now-superseded check-code sentence instead of altering the signed text. Its current reuse needs F3, F8 and F12's qualifications. No cap/budget-binding claim should be restored from human stops or the static adoption refusal.

**Part D.** The primary 2/6 package pair has the intended fixed-fail task, common graph, high nonbinding cap, no early gate, explicit node-run unit and separate watchdog. The profile and loaded-conditions additions improve the design without changing its primary outcome. The extra prose pair is explicitly separate and has recorded owner approval; it must not replace the primary pair. Five compiled budget substitutions preserve a single manipulated variable, despite the design's literal “one sentence” wording. Its dry run and frozen-prompt check pass. It remains unrun and parked. Counter attribution, the known example contradiction, and actual profile/tool protections are the remaining limits, not evidence that the pair already succeeded.

**Part F.** Chapters 1, 5, 7, 13 and 14 were read in full after A–E. Their strongest material is the distinction between a plan, instructions and enforcement; the concrete override/export limits; instruction-only access boundaries in chapter 5; the explicit non-equivalence and small-task limits; and withholding unaudited study-two results. Chapter 13's later explanation of the latest-run denominator and old versus new counts is fair. Chapter 14's audit process and first-round agreement are substantially accurate. Treat a claims row as a recorded interpretation to check against evidence and version, not an infallible authority. Chapter 5's opening “an agent cannot run a plan written as JSON” is unnecessary: an agent can follow JSON instructions; compilation supplies the harness's native files. Correct that analogy when editing the chapter.

## What I could not check

- No live model behavior, new paid run, new experiment, phone installation, Safari or native app interaction was tested. Static CLI refusal is not enforcement of a running session; the app's logic was read, not exercised here.
- I did not obtain independent server timestamps proving when registrations were pushed. Local history, record start times and unchanged registered content establish the narrower chronology.
- The raw transcripts were available for the registered runs. I did not inspect every message for every possible alias, indirect evidence transfer or loaded skill, nor independently reconstruct all 18 first-pass artifacts. The named-path/context scan cannot establish those negatives.
- I independently re-derived the overall lead usage split, not a true marginal token cost per file. The character-sharing assumption remains an estimate, and mixed-purpose categories remain the script's attribution convention.
- The paid-run dry-run command builds beneath its default profile home, outside this audit's allowed folder. I did not run it. I read its build/run/record path and ran the safe compile/check/counter tests with local scratch; I did not run the entire paid-path stand-in suite or the first paid profile call.
- I did not read the code of the unmerged follow-ups #142, #60 or #127. They cannot close findings at this snapshot. The cost page's four overlay files are the sole unmerged material audited.
- This is not a re-audit of every old claim or every guide chapter. Changes and high-risk sentences were read across the named documents; chapters 2–4, 6 and 8–12 were not read in full. I did not re-run every copied guide command or all core/CLI tests. The specified five chapters have a reading, not blanket acceptance of the whole guide.

## If a new experiment is needed

No new experiment is needed to correct the words, reproduce F1/F2, or state the current scores. Keep the paid experiments parked.

When the owner resumes them, the primary fixed-fail 2/6 pair remains the smallest test of one package budget holding continuing failure. Resolve the counter's execution attribution before using its pass as evidence, verify the actual profile boundaries at the already planned first paid call, preserve the current compiled treatment and its contradictory example, and report both runs whatever happens. A successful pair supports one observed dispatch-budget case, not general bounding or reliability. An equal-unit prose comparison is a separate prospective decision. To test quality or the causal value of review structure, a later design must equalize access to the same evidence and pre-register an independent task-quality measure; the present D comparison does not do that.

## Prompt to carry back

```text
Read /Users/noir/Documents/grooph-exchange/codex/0001-claims-as-of-0-3-0/round-02/HANDBACK.md and notes/AUDIT-NOTES.md. Reconcile round two finding by finding, F1–F16, against snapshot faba78aeff36e9aca5c02c8e726086cbe10191f5 and the separately identified cost-page overlay 980bcb6. Attack the auditor's interpretations as well as the claims, and record agreement, partial agreement or disagreement with evidence.

In particular, reproduce the model-free stop-order adoption and counter-replay probes from their exchange-local sources and receipts: a legal equal-budget stop reordering is adopted without --allow, and printed replay output can count as a check and yield met. Do not assume the unmerged halt-to-success fix closes the ordering case. Keep known and newly found limits separate. Reconcile the hidden-suite-versus-quality distinction, the builder-input table, the cost-allocation limits, the latest-run denominator, and the five requested guide chapters.

Preserve existing evidence and signed decisions; use dated clarifications where needed. Propose concrete corrections for the owner's decision under decision 0024. Study two and the guide do not become publishable merely because this handback exists. Keep the qualified comparison scope and the distinction between an invoker's --allow and a person's approval. Start no model session or new experiment for this reconciliation, keep paid runs parked, and do not merge or publish on the auditor's authority. Finish with the next review-desk decision for the owner and a prompt to carry back if another audit round is needed.
```

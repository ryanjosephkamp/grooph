# Audit 0001-claims-as-of-0-3-0 · round 03 · handback from Codex

**From:** Codex (GPT-6.1 Sol) · **To:** the audit lane (Claude Code) · **Date:** 2026-10-06 · **Commit read:** `c1ff8f7fd6a7a90602e883970ae1cf7962575893` · **Changed anything:** no, in the snapshot or grooph repository; only this audit folder

## Verdict in one paragraph

The stops repair holds for the two reported faults and the further valid controls I tried, through adoption, export and subgrooph refresh. It is a real, conservative, incomplete comparison, not enforcement of a running graph. Routes around a limit remain adopted, and a plain reader would reasonably call several of them loosenings; the unresolved contract question must remain visible. CLI export and MCP export match their declared baseline and override rules in my probes, including refusing to write on a detected loss, but their local baseline is replaceable and their flags do not authenticate a person's permission. I found no additional export route outside the documented classes. The guide can be published after the chapter corrections below and reconciliation: its main account of the evidence is substantially fair, including the latest-run denominator and study-one figures, but several categorical explanations, one incomplete rule table, two manually substituted version lines, and stale audit statements cannot stand as written. This is a second AI reading of this snapshot, not a proof of completeness, a human acceptance, or a result for released 0.4.1.

## Findings

Paths beginning `docs/`, `packages/`, `apps/`, `patterns/` or `experiments/` below are in the named round-three snapshot. Probe output and exact invocation manifests are in [notes/READING-AND-PROBES.md](notes/READING-AND-PROBES.md), [lane-probes.json](notes/lane-probes.json) and [reader-probes.json](notes/reader-probes.json). Each scratch-taking invocation received a distinct new empty folder under `round-03/notes/probes/`.

### F1 · Part H: the repaired comparison still admits changes a reader would call loosenings

- **Claim:** C45; `docs/runs.md`, “What adoption does not hold”; `docs/releases.md`, “Not yet released”; the handoff's q66 question.
- **Severity:** blocks a blanket “never loosen” claim; note on the correctly scoped repair.
- **What I read or ran:** `brakes.ts`, `reach.ts`, the three lane stops probes, driver `cases-a/b/p`, `p2/cases-more`, `p2/cases-two-loops`, `cases-sub`, and [own-probe.log](notes/own-probe.log). I reproduced the plain edge to success, leading stops in inner/enclosing loops, and the one-node-loop road; they are adopted and exported. I also reproduced an allowed retained-critic bar moved before a halting cap, removal of a halting diminishing-returns stop, and new human stops.
- **The problem:** A new road from a worker to success can prevent the old loop's halting limit from deciding the result, without changing that limit's JSON. That is a loosening in an ordinary reader's sense. The documents disclose these classes accurately; disclosure does not make them preservation of every brake. Retaining a critic exempts its “bar passed” stop from this repair; the old cap/budget can consequently lose precedence. Halting diminishing-returns/evidence-invalid stops are outside A-008's protected list. A newly added human stop is named but allowed: “each lap is a person's decision” is false for a large `every`. With `every:100` ahead of cap 1, no asking is reached; ahead of cap 100, the first asking can redirect the run only on pass 100. The decision at an asking is the person's, not every intervening pass.
- **What would change my mind:** An explicit owner ruling defining which of these changes are permitted adaptations, or a comparison that holds them under a stated, tested rule. A green probe for a different route does not close them.
- **What I would publish instead:** “The comparison holds the specified cap, budget and asking losses it detects. It still permits documented roads around a limit, retained-critic bar stops and changes outside that protected list. New human stops are a person's decision when they fire; they need not ask on every pass.” Keep q66 unresolved as of this snapshot. Do not report it as a repaired fault or infer a later owner answer.

### F2 · Part H: the new pass rule and some generated words do not agree

- **Claim:** The driver's third reader found nothing untrue in the reasons; the precise firing rule added by #173.
- **Severity:** wording.
- **What I read or ran:** `docs/graph-ir.md:178`; `packages/core/src/brakes.ts:532`; Claude Code `lead.ts:294,320` and `kickoff.ts:58`; [supplementary.log](notes/supplementary.log). For human 3 changed to human 2, the comparison says “on round 3 nobody would be asked.” The independent trace asks in the source on pass 3/round 2, and in the copy on pass 4/round 3.
- **The problem:** The reason uses an ordinal pass as a numbered round, contradicting the newly explicit zero-based round convention. The compiler still says to evaluate stops “before every round,” without carrying the new nth-pass sentence. This may be read as before the next pass, but it is weaker and less clear than the specification and cannot be cited as an exact translation of it. These are wording faults, not evidence that the repaired comparison uses the wrong cap timing, or that a recorded session actually miscounted.
- **What would change my mind:** Generated reasons saying “on pass N,” and compiled instructions explicitly distinguishing the completed pass count from the round number, with a static cap/human example at the boundary.
- **What I would publish instead:** “A cap of N is tested after the Nth completed pass, numbered round N−1. Human every N asks after passes N, 2N, 3N.” Use “pass” in the refusal example. Retain the narrower finding that the comparison held the cases tested; withdraw the unqualified finding that every printed reason was true.

### F3 · Part H: costs reproduce, but model negatives and one reader's three heads are not proofs

- **Claim:** The handoff's honest-edit costs, the driver's three readings, and the performance account.
- **Severity:** note.
- **What I read or ran:** All three driver reports and available single-build scripts; [reader-honest-random.log](notes/reader-honest-random.log), [reader-honest-builtins.log](notes/reader-honest-builtins.log), [reader-every-lowered.log](notes/reader-every-lowered.log), [reader-perf-shared.log](notes/reader-perf-shared.log), and [exact-stops.log](notes/exact-stops.log). The random refusal counts reproduce: leading budget 558/747, cap 282/507, diminishing-returns rounds 371/486; human period lowered by one 100/1,185. One of 575 built-in honest edits is held: debate cap 2→1. The exact-period helper reports 893/2,917 nondivisor edits held, 835 with a modeled witness and 58 without one; divisor and every-round changes have zero refusals.
- **The problem:** The 58 are finite-model negatives, not automatically 58 proven unnecessary refusals. At least the simple human-3/cap-8 versus human-2/cap-8 case really is conservative: the source leaves on pass 8, before another asking, while both reach the same leading cap. The comparison does not know actual spend per pass; calling all 100 old-helper human refusals false positives would also confuse its older semantics with the final rule. My separate finite model found 823 losses among 5,604 valid changed pairs and missed zero corresponding stops refusals, but its 358 held-without-witness cases are likewise not a general false-positive count. The historical multi-head counts cannot be reproduced from the missing builds. One reader examining three heads is one reader. The slow shape is real here: 40 loops × 40 stops took 14,864 ms and generated 12,248,844 reason characters. This is a usability risk even though the graph is valid; a size warning is not a cost bound.
- **What would change my mind:** A complete argument for a negative-model classification, or an explicit bound stated with it; reproducible builds for historical regression counts; bounded/deduplicated reasons and a measured improvement for the slow shape.
- **What I would publish instead:** Publish the reproduced counts with their inputs and the conservative spend/period assumptions. Call unavailable multi-head counts the driver's historical evidence. Describe the slow shape as one measured static comparison, without claiming an asymptotic exponent or normal-use timing. No paid run is needed to investigate it.

### F4 · Part H documentation: the release's built-in exemption and audit-status tail are stale

- **Claim:** `docs/releases.md:30`, “None of the built-in templates is open to either, as far as was tried”; C45's audit-status column; the handoff's account of the lane's failed template scan.
- **Severity:** wording.
- **What I read or ran:** The dated 0.4.0 clarification, current `docs/runs.md:81`, corrected instantiated built-in probe, three driver reports, and the current debate controls. The current write-up itself says 84 leading additions were unheld at 0.4.0 and 77 after the repair: seven formerly admitted debate additions.
- **The problem:** The dated release clarification preserves the earlier “none open” conclusion after the record discredits that scan for refusing uninstantiated templates. A qualifier about what was tried must name the invalid scan, not keep its clean bill. The old C45 status tail still says the refusal waits for round two, while its body describes round-three work.
- **What would change my mind:** An additional dated clarification separating the invalid template scan, later instantiated evidence and repair; acceptance status keyed to the actual version and surface read.
- **What I would publish instead:** Add a new dated note: “The initial built-in scan did not test adoption of instantiated graphs. The later scan found seven additional unheld leading stops in the debate at 0.4.0; the repair holds them.” Preserve historical text if that is the custody rule, but supersede its conclusion visibly. Update C45's status without upgrading the whole comparison to “shown.”

### F5 · Part I: export compares a replaceable local baseline, not the original approved graph

- **Claim:** C45 and export's “none of the brakes it compares was removed or loosened”; “only on a person's word.”
- **Severity:** note; blocks an authenticated-permission or original-baseline claim.
- **What I read or ran:** `packages/cli/src/commands/export.ts` (`brakesAtExport`, `writtenFrom`), MCP export and placement guards; [own-probe.log](notes/own-probe.log), [supplementary.log](notes/supplementary.log). A cap raised over an intact package is held. Missing, malformed, mismatched-id, stale graph/lead/mapping and other-harness baselines require explicit uncompared replacement. Coherently rewriting the kept graph, LEAD and MAPPING to the raised cap, then exporting it, succeeds at both doors and truthfully says it is the same kept graph.
- **The problem:** The two compiled baseline files establish local consistency, not custody of a previous approved version. Agent files are not all byte-checked as that baseline; selected model headers are read for a separate model-change check. Removal of an irreversible marker from the kept graph alone is expressly documented as invisible to these two baseline files. Any actor able to change the baseline or supply the flags can get past the refusal. This is disclosed and is not a newly discovered export bypass. I did not find the requested additional route outside the documented classes.
- **What would change my mind:** A separately protected/authenticated baseline or permission mechanism, if the project wants that stronger claim. More same-function probes do not establish authorization.
- **What I would publish instead:** “Export compares against the same-id graph the local package currently keeps, provided its lead and mapping files match that graph's compilation. Detected losses require named allowance. The baseline and flags are local and editable; agents are instructed to obtain the person's permission.” Retain the qualified success line and explicit “not compared” outcomes. Do not call `--allow`, `--uncompared` or MCP `replace` a person-only lock.

### Part G · start page

### F6 · The outputs cannot all be described as what printed at 0.4.1

- **Claim:** `docs/plain-english/README.md:51–52`; chapter 12's help/version output.
- **Severity:** wording.
- **What I read or ran:** All of `docs/plain-english/`; the handoff's admission that the two version lines were substituted; [guide.log](notes/guide.log). Forty-four commands ran; exactly two shown outputs differed, both 0.4.1 versus the snapshot's 0.4.0.
- **The problem:** “Every output is what printed” and “Which grooph: version 0.4.1” are false for the actual build read here. The repair being prepared for 0.4.1 does not make it a released or numbered 0.4.1 build. The runner accepts ordered excerpts, not complete output equality. Installation and the session-starting skill are explicitly excluded; their exclusion is fair, but “every command” should name both.
- **What would change my mind:** Genuine output from the final numbered build, or visible labeling of the prospective substitutions and exclusions.
- **What I would publish instead:** “Checked against main at c1ff8f7, reporting version 0.4.0, with the repairs intended for 0.4.1. The help/version examples show [actual output / explicitly labeled expected release output]. Installation and the agent-session skill were not run.” After release, update only with actual verification.

### Part G · chapter 1: Starting from nothing

### F7 · The central table retains a watching error and needs two narrower definitions

- **Claim:** `01-starting-from-nothing.md:36,42,133–134`; the “what has force” table.
- **Severity:** wording.
- **What I read or ran:** Chapter 1, chapters 5/11/13, hook/live-view sources, the fresh-worker qualification, and study one's kept $9.02 invocation against a $9 ceiling.
- **The problem:** The table still says “Nothing in grooph watches a running session,” although the guide and command demonstrate watching its recorded activity. Lack of control is supported; lack of watching is not. A harness cutoff is real, but a nominal spending ceiling is not an exact dollar maximum: the existing record exceeds $9. Context is the conversation/instructions available to a model, not literally all its knowledge; “everything read and written so far” also needs room for finite/compacted context. The fresh-subagent paragraph should describe the fresh-worker behavior this guide uses, not every possible helper-session mode.
- **What would change my mind:** Consistent table wording, bounded spending language and context/fresh-worker definitions. Nothing here requires a paid demonstration.
- **What I would publish instead:** “grooph can watch what the run records; it cannot enforce these instructions or stop the session. A harness spending option can terminate a run, with possible overshoot. A fresh worker in this example starts without the lead's earlier conversation, with its own instructions and permitted inputs.” Keep the table's important tool/Bash gap, instructions-versus-force distinction and narrow post-run comparison.

### Part G · chapter 2: The graph document

### F8 · Adaptation, pass counting and human stops need their current rules

- **Claim:** `02-the-graph-document.md:29,147–178,199`.
- **Severity:** wording.
- **What I read or ran:** The entire chapter; graph-ir §2, especially lines 178 and 192; compiled loop instructions; its command outputs and recorded-count example.
- **The problem:** The guide permits tightening “at every level”; the contract permits amendment/tightening only in adaptive mode, not fixed or propose. The historical cap-5 example making five passes and writing round 4 is the normal five-pass, zero-based count, not evidence of the alternative “five returns” reading. After #173 the specification has an explicit cap-N/nth-pass rule; possible agent noncompliance must not be presented as two equally valid meanings. A human stop normally pauses/asks and can resume; it does not automatically end the loop. “Today's target is claude-code” is also stale now that the interface names another target; this is a documentation correction, not validation of that excluded target.
- **What would change my mind:** The current adaptation and pass rules stated without the false historical contrast, and pause/continue separated from terminating stops.
- **What I would publish instead:** “Only an adaptive lead may amend or tighten its working graph. At every level it is told not to loosen a brake. A cap of four fires after four completed passes, at round 3; a lead may misfollow that instruction. A human stop asks at its specified completed passes and may resume according to the answer.” Name Claude Code as this guide's example target.

### Part G · chapter 3: The validator

### F9 · “Every rule” omits the three new person rules and overgeneralizes irreversible steps

- **Claim:** `03-the-validator.md:90,96–133`.
- **Severity:** wording.
- **What I read or ran:** The 30-rule count, the table, `docs/rules.md`, graph-ir's rule tables and validator source. The guide table contains 16 error codes and 11 warning codes.
- **The problem:** Its stated 18 errors/12 warnings is correct, but the complete-looking table omits `E_PERSON_LEAD`, `E_PERSON_STEP_NOT_COMPILED` and `W_PERSON_FIELDS_NOT_READ`. “A marked step needs a person before every way in” omits the explicit exemption for a person's step doing that action. A preceding person's work step is not itself approval for an agent's irreversible action. The homogeneous-model row should retain “as far as the document's tiers/pins say”; a warning cannot certify resolved model diversity (chapter 5 correctly explains the default tier collision).
- **What would change my mind:** All 30 entries or a honestly partial heading; the person-action exemption and tier/pin limitation.
- **What I would publish instead:** Add the three codes with plain explanations; say “An agent's marked irreversible step needs a human decision on every way in. When a person performs the step, that person decides it.” Keep the explicit warning that validation cannot judge the brief or prove that the external check really checks the work.

### Part G · chapter 4: Templates

No blocking finding. The 20 graph templates and four person-plan templates, instantiation commands, difference between templates and runnable graphs, earlier-record denominator, and unmeasured profile labels are fairly presented. The phrase “so far every step ... an agent's” can become “every work step in our example” because earlier chapters already introduced checks and gates. Person plans having no recorded runs is stated; no benefit is inferred from that absence.

### Part G · chapter 5: The package

### F10 · The kept graph is no longer the only package file grooph rereads

- **Claim:** `05-the-package.md:86`.
- **Severity:** wording.
- **What I read or ran:** The seven-file example and export source; the stale-lead/stale-mapping and edited-agent controls.
- **The problem:** Export now reads LEAD and MAPPING to establish the local baseline, and agent-file model headers for a separate replacement safeguard. “Of these seven, the only one grooph itself reads again later” is false.
- **What would change my mind:** A file-role table describing these current reads.
- **What I would publish instead:** “The kept graph is the source for later comparison; export also rereads the lead and mapping files to check that baseline, and relevant agent headers to check model changes.” Keep the accurate tool-list, Write/Bash and tier-map caveats; those prevent a much larger overclaim.

### Part G · chapter 6: A run

### F11 · The run folder holds the run record, not everything the run writes

- **Claim:** `06-a-run.md:32`; glossary's run-folder definition.
- **Severity:** wording.
- **What I read or ran:** The complete chapter, its copied truncate/word-wrap records, graph outputs and compiled record paths; the commands in the guide probe.
- **The problem:** Code, tests and other work products are written at project/output paths outside the run folder. Even this chapter's timeline mentions such paths. A beginner could look in the record folder expecting all work or assume the folder confines writes.
- **What would change my mind:** A record-versus-work-products distinction, including the output paths.
- **What I would publish instead:** “The run's own records go in its run folder: progress, notes and working graph. The work and reports go at the project paths the graph names.” Retain the conspicuous statement that this is the kept truncate run, not a newly executed rounding example, and that the other gate example used scripted approval.

### Part G · chapter 7: Adopting a run

### F12 · The teaching list must carry the repair's actual remaining limits

- **Claim:** `07-adopting-a-run.md`, especially the limits section at lines 108–119.
- **Severity:** wording.
- **What I read or ran:** The chapter, the full limits in `docs/runs.md`, and F1's controls.
- **The problem:** Its plain-edge caveat is true and its link to the full list is useful, but the simple “only tighten” story needs at least the retained-critic bar and human-period exceptions to avoid reinstating the implication the guide is correcting. “No leading stop called tightening” must mean the specified new, changed or promoted stop, not every ordering change involving an unchanged leading stop. Audit status should distinguish the round-two reading from this repaired snapshot; neither is a completeness certificate.
- **What would change my mind:** A short accurate teaching list and dated/versioned status, with the full reference retained.
- **What I would publish instead:** “The repair holds both reported stop faults where its protected limit/asking can lose precedence. It also conservatively holds some honest edits. It still lets through the routes around limits, retained-critic bar stops, newly requested human choices and the other listed exceptions. New, changed or promoted leading stops are not labeled tightening.” Keep the chapter's excellent explanation that an agent can provide `--allow` and that the instruction to ask is not a lock.

### Part G · chapter 8: Subgroophs

### F13 · Compilation is deterministic only with its other inputs held fixed

- **Claim:** `08-subgroophs.md:65,96`.
- **Severity:** wording.
- **What I read or ran:** The whole chapter, compile options and subgrooph refresh; [supplementary.log](notes/supplementary.log). The same graph compiled with another model map produced different package files.
- **The problem:** “The same document always gives the same package” omits target, compiler version and model-map inputs. Fetching nothing while compiling is true, but does not make the document its only input. “Has not yet been audited” is stale for the old comparison and needs a specific repair/version qualification.
- **What would change my mind:** A bounded determinism statement and current audit status.
- **What I would publish instead:** “With the same target, compiler version and model options, compiling the same document yields the same package, without fetching a template.” State which comparison version was read. Preserve the distinction between embedded ordinary graph content and later refresh; in the tested refresh, held changes stayed back despite an overall exit 0.

### Part G · chapter 9: Operation maps

### F14 · A wrong map can mislead a person; declared carrier checks are not connectivity evidence

- **Claim:** `09-operation-maps.md:19,55,76,81`; the matching “harmless” sentence in `docs/operation-map.md`.
- **Severity:** wording.
- **What I read or ran:** The chapter, map reference, map validation and carrier rules, fixture and export refusal.
- **The problem:** “Wrong, and harmless, because nothing depends on it” is a new categorical safety claim even though it is copied from the reference. The chapter itself says people use maps to make coordination decisions. A wrong map can mislead them. “No agent reads a map” can only mean that grooph does not automatically dispatch agents from one; nothing prevents a person handing its text or view to an agent. “Sessions in the same lane can reach each other directly” and “a message cannot cross accounts” describe assumptions of the declared carrier model, not a measured permission/connectivity result for every harness or external integration. The validator does not try the transport or authenticate accounts.
- **What would change my mind:** A claim restricted to what the map validator assumes and to the absence of automatic execution, or actual bounded connectivity evidence for a stronger statement.
- **What I would publish instead:** “grooph does not execute a map. A stale map does not automatically reroute work, but can mislead people using it. Its warnings check the carrier against the lane/account declarations and supported assumptions; they do not test delivery.” Keep the map/graph distinction and named refusal to compile a map.

### Part G · chapter 10: Pictures and views

### F15 · Views are projections; offline reading needs no automatic network fetch

- **Claim:** `10-pictures-and-views.md:11,84,100`.
- **Severity:** wording.
- **What I read or ran:** The complete chapter, picture/outline and `packages/core/src/offline.ts:135,152`; generated guide artifacts; [outline-probe.log](notes/outline-probe.log). Two valid graphs differing in `bar.answerKeyFrom` produce identical outlines, though compilation distinguishes them.
- **The problem:** The offline page embeds its data/assets and restricts ordinary network fetching; that is supported. It can also contain an explicit “With a network, open it in the app” link. “Cannot ask the network for anything” hides that user-initiated navigation. The phone picture is a projection with one-line node text, not literally every field. The outline is fuller, but “hides nothing” is also false: it omits the node from which the bar's answer key comes. I found its policies present, and do not claim the outline omits those.
- **What would change my mind:** The no-network statement bounded to offline reading/automatic fetching; views described as projections, or the missing field represented before promising complete review.
- **What I would publish instead:** “This file can be read offline: its picture, text and document are embedded and it makes no automatic network fetch. Choosing its online-app link opens a network page. The picture is an overview; the outline shows full briefs and the main graph details, but does not replace checking the document's remaining fields.” This is not evidence of automatic data transmission.

### Part G · chapter 11: Watching a run

No blocking finding. The distinction between hook metadata and deliberate MCP text, local appending versus optional sending, transcript-path dependence, and watching without control is materially sound. I read the hook and sender paths; I did not install a hook in the user's real harness or run a sender/push. The chapter's ordinary metadata explanation must not be borrowed to claim that deliberate notes/plans contain no text. Chapter 12 needs F16 for that related recording behavior.

### Part G · chapter 12: The command line and the app

### F16 · Two MCP tools write records without a supplied filename

- **Claim:** `12-command-line-and-app.md:101`, “A tool writes a file only when it is given a name for one.”
- **Severity:** wording.
- **What I read or ran:** The whole command table and current CLI help, MCP tool definitions/handlers; direct `grooph_note` call with text only in [own-probe.log](notes/own-probe.log). It wrote `.grooph/events/said-static-audit.jsonl`. The tool list has 14 entries as the revised chapter says.
- **The problem:** That filename rule is reasonable for the authoring outputs but false for the run tools `grooph_note` and `grooph_plan`, which choose local event-record paths themselves. The latter is also easy to confuse with the authoring command for a plan for people.
- **What would change my mind:** Separate recording tools from authoring file-output arguments.
- **What I would publish instead:** “Authoring tools write named outputs when requested. The lead's note and subagent-plan tools append local event records using grooph's chosen filenames, without a filename argument. None of these tools calls a model or starts an agent.” Keep the current 14-tool count, command list and explicit admission that the design skill was not run. Correct help/version with F6.

### Part G · chapter 13: What the experiments found

### F17 · The figures stand; spending, preregistration and audit status need narrower words

- **Claim:** `13-what-the-experiments-found.md:25,54,89,103`; chapters 1/13's “hard limit.”
- **Severity:** wording; note on the lane's numerical verification.
- **What I read or ran:** This chapter and study-one/proving records only; existing record-reading checks, [proving-summary.log](notes/proving-summary.log), [study-one-summary.log](notes/study-one-summary.log), raw result costs and the original first 40 comparison ledger entries.
- **The problem:** The guide's $41.12 is correct: raw counted costs total $41.116289. The existing summary instead reports $41.09 by adding individually rounded rows; that disagreement is a verifier rounding artifact, not a reason to correct the guide. Study one has 27 arm records; its original 40 ledger invocations total $60.624963, supporting $60.62. The corrected losing-condition account and “not equivalence” are fair. But a harness “hard” spending limit can overshoot ($9.02 is already on record), and preregistration does not prevent anyone reinterpreting success: it preserves criteria against which that reinterpretation can be checked. The “only one AI / next round” status of the second comparison is stale beside chapter 14's round-two history.
- **What would change my mind:** Aggregation before rounding in numerical verification; spending language admitting possible overshoot; a preregistration claim about auditability; versioned audit status.
- **What I would publish instead:** Keep the figures and limited study-one conclusion. Say “The harness can terminate at a spending setting, with possible overshoot,” and “Writing the criteria first makes later interpretations auditable.” Update the status sentence from the already reconciled record. Do not republish or re-audit study-two results under this finding.

### Part G · chapter 14: The claims page and the audit

### F18 · Publication should record reconciled findings and retained limits, not an all-corrected implication

- **Claim:** `14-claims-and-the-audit.md:13,62,67,69–73`; PR #168's proposed post-round-three text.
- **Severity:** wording.
- **What I read or ran:** The full chapter, round-two reconciliation, handoff and copied PR #168 description.
- **The problem:** The chapter says the lane was wrong twice in its first answer; the handoff and reconciliation record say three times. The “every statement” language should mean the 52 identified claim rows, not a proof that every published sentence was inventoried. “Repaired in version 0.4.1” is prospective at this 0.4.0-numbered snapshot. PR #168's publication wording is acceptable only when the actual site publication and reconciliation have happened. “What it found was corrected” would obscure retained limitations and owner choices such as q66. A second AI reading is not a human review or a universal guarantee.
- **What would change my mind:** Accurate counts, dates/version scope and an explicit record of corrected, retained and unresolved findings; actual publication before saying the guide is on the site.
- **What I would publish instead:** “Codex read five chapters in round two and all fourteen plus the glossary in round three, against c1ff8f7, a 0.4.0-numbered build containing repairs intended for 0.4.1. Findings were reconciled; corrections and remaining limits are recorded.” Fill the publication sentence only after publication, and preserve the existing caution to check both the claims row and the evidence.

### Part G · glossary

### F19 · Definitions must carry the same caveats as the chapters

- **Claim:** `glossary.md`, entries Context, Subagent, Run folder, Stop, Budget and Round cap.
- **Severity:** wording.
- **What I read or ran:** Every glossary entry against its chapter and `docs/GLOSSARY.md`; F7/F8/F11.
- **The problem:** “All the session knows,” “where a run writes everything,” and a stopping-rule definition that treats human asking as automatically ending a loop repeat the chapter errors. Bare budget/cap definitions can sound enforced when consulted without chapter 1.
- **What would change my mind:** Definitions aligned to the corrected chapters.
- **What I would publish instead:** Define context as available conversation/instruction material; qualify the fresh-worker subagent; define the run folder as the run's record; distinguish a human pause from termination; call budget/cap written limits the lead is instructed to observe. Keep the clear Halt/Halted and person-step distinctions.

### Publication line for every chapter

These are conditional content judgments. They authorize no site merge or publication; reconciliation and the owner's process still apply.

| Chapter | Could go on the site once corrected? |
|---|---|
| 1 · Starting from nothing | **Yes**, after F7, especially the central table. |
| 2 · The graph document | **Yes**, after F8 and consistent pass/round words. |
| 3 · The validator | **Yes**, after F9's complete person-rule coverage. |
| 4 · Templates | **Yes**; no blocking finding, with the small work-step clarification above. No paid template-description change is required here. |
| 5 · The package | **Yes**, after F10's current file-reading roles. |
| 6 · A run | **Yes**, after F11; keep the kept-record/example separation. |
| 7 · Adopting a run | **Yes**, after F12, with F1's remaining limits and q66 visible. It need not claim those gaps repaired. |
| 8 · Subgroophs | **Yes**, after F13's bounded determinism and dated audit status. |
| 9 · Operation maps | **Yes**, after F14; remove the harmlessness inference. |
| 10 · Pictures and views | **Yes**, after F15's overview/offline precision. |
| 11 · Watching a run | **Yes**; no blocking finding. Preserve deliberate-text versus hook-metadata and local-versus-sent distinctions. |
| 12 · The command line and the app | **Yes**, after F16 and F6's output corrections. |
| 13 · What the experiments found | **Yes**, after F17; retain the correct figures and only the already reconciled study-two status. No new paid evidence is required for these corrections. |
| 14 · The claims page and the audit | **Yes**, after F18 and the actual reconciliation/publication record. |

The start page additionally needs F6 and the actual audit/publication status; the glossary needs F19. None should say every finding was repaired when a finding was instead scoped, retained or left with the owner.

## What I checked and found sound

**G.** I read the start page, all fourteen chapters and glossary, rather than treating the command runner as a prose audit. The command runner's 42 accepted outputs are consistent with the visible examples under its excerpt/path rules; the two differences are isolated in F6. I found no excerpt hiding a reversal of the reported result, but accepted excerpts are not byte-identical complete transcripts. The three implicit setups are disclosed: restart the chapter-four template, copy the chapter-nine fixture, and use chapter eleven's own empty project. Install commands and the design skill were not run. The validator examples leave their source unchanged. Plans are presented as readable person plans rather than packages; operation maps are refused as maps. The tool-list enforcement caveat, fresh-worker qualification, held-record provenance in chapters 6/7, gate/scripted-approval distinction, latest-20 denominator, 18 selected-check passes/two failures, seven earlier records/six failures, and study-one limited conclusion are sound. I did not turn their selected checks into evidence of full execution fidelity or quality.

**H.** Both swaps and all six new-leading-stop cases are held. The plain cases establish `loop:<id>.stops` timing/precedence refusals; they do not rely on a critic/check route being blocked. The raised-budget control is held for raising that budget. The valid no-critic bar and asking controls are held by the named loop; retained-critic and new-human exceptions remain allowed, as stated. A newly added human stop no longer launders the later leading-cap loss. Same-back-edge loop controls with the new leading cap or leading bar are held by the original loop's stops. Divisor/every-round asking changes remain allowed. A halting cap lowered through `then` to a halt keeps its tightening label. The label's new/changed/promoted qualification is essential: moving an unchanged leading stop later or moving a halt first can be an actual tightening.

The built-in probe now instantiates the graphs and compares the intended stops rather than refusing templates for `E_IS_TEMPLATE`. It reproduces 1,306 valid insertions, 77 unrefused (69 human/8 human gate), no other unrefused class, and no tightening label on those leading insertions. Person plans in that sweep are direct-core comparisons, not runnable packages.

I also tested adoption's working-copy validity and inspected refusal causes. The old lane `variants2` judgment bar has empty `inspects` and is refused by **`E_JUDGMENT_LOOP_NO_BAR` before comparison**: that good news proves no stops repair. Driver refresh's exit 0 is equally easy to misread: it retains the refused `loop:q-list.stops` change and applies other changes. The output and the resulting loop confirm the refusal. F3 separates bounded model evidence from completeness.

**I.** At both doors, the valid held cases in my fifteen source/copy probes left every package byte unchanged. Baseline controls covered intact/same graph, cap raised, correct/unknown allowance, missing kept graph, malformed graph, mismatched id, changed kept graph, changed LEAD, changed MAPPING, missing/edited agent file, first export/new id, graph-file symlink and other-harness state. Placement rejects the symlink; that is a path guard, not a brake-semantic finding. Missing/unreadable/stale/mixed baselines wait for explicit uncompared replacement, and successful replacements say **not compared**. A stale but readable graph can still produce a named loss that needs allowance too. A new id reports the other package and says it was not compared. Correct named allowance is reported as allowed; an unknown name does not override the detected loss.

MCP `replace:true` alone does not override an intact-baseline brake refusal; the named allowance does. On an unreliable baseline, replacement also explicitly means uncompared. Direct handler calls are static program calls, not a new model/MCP client session. I exercised only other-harness baseline-state handling, not the excluded Codex target's compilation/validation. Successful `brakes:` lines in the cases tried are true within their stated comparison scope; refused commands can end with an error or instruction rather than such a success line. Known allowed bypasses say none of the brakes **it compares** was loosened, not that all routes preserve the old contract.

The coherent-baseline rewrite succeeds as documented. I did not find an additional unlisted way to place a loosened graph with a misleading success line. This is a bounded search result, not a statement that the documented list is exhaustive.

## What I could not check

- First/second head builds are absent. I did not run the wrappers with deleted worktree paths, `p2/fuzz2.mjs` or `p3/tri.mjs`. Historical exhaustive/regression counts, including 457,999 label changes, remain the driver's evidence. I reran the available single-build scripts; the current CLI label sample was 40 cases, not its historical 120.
- The owner's q58–q64 answers, q66's unresolved state and template-description ruling are relayed in the handoff, not independently accessible receipts. CI passing is also the driver's report; I did not rerun an aggregator or build.
- No genuine native hook event, transcript access, sender transmission/push, live hosted site, mobile browser or real model dispatch was exercised. Source/static command checks do not establish those behaviors on the user's installed harness. Hook installation and watch were confined to the disposable guide scratch.
- No 0.4.1 release was inspected: this build says 0.4.0. Corrections/version substitution need final release verification if the guide is published as a released-version guide.
- I did not repair or re-audit the budget experiment's counter, rerun an experiment, validate the Codex target, or re-audit study two. The added words **“given only the visible task”** clarify the judges' input and do not change my round-two meaning; they do not remove the requirement to say what the author's scores measure.
- My finite firing model and source review do not establish completeness for arbitrary nested graphs, combinations of decisions, arbitrary stop lists, runtime obedience, or real cost limits. I have stated their bounds rather than treating unknown as safe.

**Custody:** The final check is recorded in [notes/custody.json](notes/custody.json): the snapshot remains at the named commit and clean; all 4,366 tracked/built file hashes in the before manifest agree afterward. No source, build or installed dependency was changed by these commands. The working grooph repository was not operated on.

## If a new experiment is needed

None is required for G/H/I's wording corrections, the static repair verdict or the export-baseline findings. Do not unblock the parked budget runs or proving runs from this handback.

If the owner chooses broader brake preservation at q66, first define the invariant and add static adversarial examples for ordinary edges, nested/enclosing/one-node loops, retained-critic bars and human periods. Reuse independent firing/reachability checks; distinguish a conservative refusal from a witnessed loss. For performance, use the existing static 40×40 shape and compare reason volume/time after a change; no model session is necessary. An eventual experiment about runtime obedience or quality would be a separate authorized design with its own counter and acceptance rules.

## Prompt to carry back

```text
Round three's handback is ready at
/Users/noir/Documents/grooph-exchange/codex/0001-claims-as-of-0-3-0/round-03/HANDBACK.md,
with probe manifests and evidence in round-03/notes/. Read it against snapshot commit
c1ff8f7fd6a7a90602e883970ae1cf7962575893 and reconcile F1–F19 by number, preserving
the handback and original evidence.

The specified stops repair holds in the valid controls, and both export doors match
their declared local-baseline rules. This is not complete preservation or a person-only
lock. Keep q66 and the documented roads around limits visible; distinguish new human
asking from a decision on every lap. Address the pass/round wording, the stale built-in
release conclusion, and conservative-refusal/performance costs without overstating
bounded models or the one driver's reader.

Correct the guide by chapter, including the central watching/spending table, adaptation
levels and pass count, three omitted person rules, reread package files, record-folder
scope, compilation inputs, map harmlessness, offline wording, MCP automatic records and
dated audit status. Keep the correct $41.12 and $60.62 figures; aggregate costs before
rounding. Use the chapter publication table, and record which findings were corrected,
retained or left unresolved. Do not say the guide is published or every finding repaired
until that is true. Verify final version output before presenting a 0.4.1 release guide.

This round authorizes no paid run, model session, budget-counter repair experiment,
study-two re-audit, Codex-target validation, or site publication. Return the concrete
reconciliation and any owner decisions required by the existing process.
```

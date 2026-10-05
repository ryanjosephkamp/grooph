# Audit 0001-claims-as-of-0-3-0 · round 01 · reconciliation

**By:** the audit lane (Claude Code, Opus 5.5) · **For:** the owner · **Date:** 2026-10-05 · **Handback:** `round-01/HANDBACK.md` (Codex, GPT-6.1 Sol, written 2026-10-04 20:26 ET; 21 findings)

The owner did not carry Codex's prompt back: the lane found the handback on disk on 2026-10-05 and reconciled it. One carry out, none back, for this round.

## Where the two sides stand

Codex returned 21 findings. The lane **agrees with 19 and partly with 2**; it disagrees with none. Three findings block a claim as published (F1, F3, F6); the lane had already read two of those claims as not carried, and all three are settled by a change of words, not by a dispute. **Codex corrected the lane three times, and was right each time**: a correction cycle did turn in study one (F1), `review-gate` did not meet its pre-registered losing condition (F2), and one of the four suites was not at its ceiling (F5). The lane checked each in the primary records before agreeing.

Nothing remains disputed. What remains is the owner's: which words replace the ones the evidence does not carry, and whether to run the one small experiment both sides say is needed before "bound" can be claimed.

Since the audited commit, `main` has gained comparison study two (pull request #97). Its claims have not been through this loop. They are named below where they bear on a correction, and are the main subject proposed for round two.

## Finding by finding

| Finding | Claim | Codex says | We say | Why | Proposed correction | New experiment? |
|---|---|---|---|---|---|---|
| F1 | C1, C12, C16, C17 | A correction cycle did turn in study one, in prompt run B-1; its first trace is inside the written contract; the two traces came from two red teams, not one | **agree** | Checked: the contract says "For every string"; only the timing line is limited to 100 KB. The digest shows the first red team writing `range-error-on-many-fields.md` at 22:25:58 and the second writing `frozen-error-prototype-typeerror.md` at 22:36:40, with a builder between. The lane had repeated the write-up's "two traces outside the contract" and decision 0012's "no loop turned in 27 runs"; both are wrong | 9, 10, 26 | no |
| F2 | C14, C13 | `review-gate` met neither its success nor its losing condition; `spec-then-loop` lost in two of three, not three of three | **agree** | Checked: the losing condition is "in both replicates at lower cost"; B-2 cost $1.049908 against A-2's $1.019783. B-3 of `spec-then-loop` cost $2.659999 against A-3's $2.426888. The lane had checked when the conditions were committed and not whether each was met | 9, 26 | no |
| F3 | C1, C16, C19 | Gates are a real, limited boundary (14 halt notes); no cap or budget is on record as firing; say "is recorded as firing", not "has yet had to fire" | **agree** | The lane's own count. Codex's wording is the better one: it says what the records show and nothing about what a run needed | 1, 2, 3, 8 | yes: a brake that binds |
| F4 | C2, C4, C12, C15, C17, C51 | The comparison was a package against a derived role-and-routing prompt, which also differed in agent configuration; not record against no record | **agree** | Checked: the derivation keeps Brief, Inputs, Outputs and Capabilities and drops the tool allowlist, Ownership, Evidence rules and Report format. In `spec-then-loop` B-3 a planner started an `Explore` subagent of its own. The lane's "the same design without a record" was too strong | 9, 10 | no |
| F5 | C4, C14, C17 | No quality advantage was shown; that is not equivalence; three suites were saturated and `grind-loop` was 61 of 62 | **agree** | Checked: all six `grind-loop` runs scored 61 of 62. The lane wrote "every arm was at the top"; it was not. On the judge: the lane read the gap between arms B and C as judge noise; Codex is right that they are different outputs, so it is variation between runs of one treatment, whatever its source. The caution about reading a rank stands | 9 | no |
| F6 | C3, C7, C45, C48 | Eighteen passing checks are checks of selected expectations, not complete verification of a runtime contract; adoption does not refuse a loosened brake | **agree** | The lane ran the probe Codex could only reason about: `grooph adopt --write` accepted a working copy whose round cap went from 4 to 40 and whose budget went from 10 to 400, and wrote version 2. Codex's reading of "contract" is fair: the word can stay where it plainly names what the session is told to follow | 1, 2, 5, 7, 12, 20 | no |
| F7 | C19, C20 | The validator requires a named stop, and refuses a shared critic only under a declared policy | **agree** | Same probes, same reading. Keep the built-in templates' caps as a fact about the templates | 4, 5, 6 | no |
| F8 | C21, C19, C52 | The irreversible rule covers marked nodes; it polices no action at run time | **agree** | Same probes | 5, 6, 22 | no |
| F9 | C10, C46, C49 | The sorting of the six edges is sound; say "was instructed not to read", not "could not see"; "a loop with nothing hidden does not turn" is contradicted | **agree** | `merge-queue` turned with nothing held out, and so did B-1. The planner in `gauntlet-decomposed` passed the reference on, so a builder's own reads are not the whole test | 8, 20, 26 | no |
| F10 | C5, C6, C8 | Keep the counts; do not flatten the pre-registration into four against sixteen | **agree** | Tasks and expected checks were committed before every run; the second batch added written bets; the last four added probabilities. The lane's "the first five had neither" understated the first five | 1, 8 | no |
| F11 | C2, C7, C47, C48, C51 | Resume, completeness and the cost of the record need narrower words | **agree** | The lane's own findings, with Codex's distinction that the checker flags a missing ending and the monitor has no such state | 2, 7, 20, 21 | no; a fresh-session resume is a measurement worth one short run |
| F12 | C18 | Study two's design mixes reviewer-only information with workflow, and would not test a brake | **agree** | Borne out since: study two ran (pull request #97). Its handback says no brake fired in any run, and that what ended above the task alone was "a reviewer's held-out evidence reaching a builder", the same in the package and in prose | 9, 11 | yes: the same one as F3 |
| F13 | C30, C34, C39 | The sender also carries deliberate MCP notes and plans, text and all; that is material, not a nuance | **agree** | The lane had it as an omission. Codex is right about its weight: a reader told "ids, names and times" would not expect free text on a public branch | 13, 14, 23, 24 | no |
| F14 | C35, C36 | The sender's file selection is wider than "its own", and a push can lack a readable sign in three ways, not two | **agree** | `record()` swallows a failed write of its own status file | 14 | no |
| F15 | C37, C52 | One retained trial of ten; no capacity follows; withdraw the arithmetic ceiling instead of correcting it | **agree** | 45 seconds at 2.5 a round is 18, and neither number is a capacity | 14, 23 | no |
| F16 | C31, C32, C33 | The hook returns no decision; launching it can fail; an agent can read what it wrote | **agree** | The lane's qualifications, better put: "returns no decision" in place of "cannot steer" | 13, 14 | no |
| F17 | C38, C39, C40, C41 | Reports and a plan keep their provenance; "normally" has no measured rate | **partly** | Agree on all four. The lane had read C41 as carried and now reads it as carried with other words. The one thing held back: whether the plan's count is worth publishing at all is the owner's taste, not a finding | 15, 25 | no |
| F18 | C42, C43, C44 | Route sizes re-derive; a first visit then fetches more for offline use; the timings ran with service workers off; 40 ms has no measurement | **agree** | Checked: `main.tsx` registers the worker on load and warms the other pieces; `perf-loadtime.mjs` sets `serviceWorkers: "block"`. The lane had not seen this | 16, 23 | no; two measurements |
| F19 | C49, C50 | Critic benefits and one-pass rewriting are design choices, not measurements | **agree** | Same reading | 17, 22 | no |
| F20 | C25, C26, C27, C29 | "Does not host anything" is too wide (`grooph watch` serves locally); one request is a HEAD; phone and offline rest on tests of a sized window and a cached app | **agree** | Checked both. The lane wrote "every fetch is a GET"; one is a HEAD to its own origin | 3, 18 | no |
| F21 | C52 | The smaller points need provenance and denominators | **partly** | Agree on each. "Nineteen of nineteen" is a true count of the stops that followed a turn; the fix is to add the twentieth, as Codex says, not to call the sentence false, as the lane's list implied | 23 | no |

## Every claim after round one

Both sides' reading, now the same for all 52.

| Reading | Claims | How many |
|---|---|---|
| Carried | C4 (with F5's limits), C9, C11, C13, C16 (the numbers), C22, C23, C24, C26, C28, C33, C42 | 12 |
| Carried with other words | C2, C3, C7, C8, C10, C12, C14, C15, C17, C18, C19, C20, C21, C25, C27, C29, C30, C31, C32, C34, C35, C36, C37, C38, C41, C44, C45, C46, C47, C48, C50, C51, C52 | 33 |
| Not carried as worded | C1, C5 (the README's "proven"), C6, C39, C40 (as a count of what happened), C43 (as a measured number), C49 (as findings) | 7 |

Changed by the round, against the lane's first reading: C7, C14, C18, C25, C27, C29, C37 and C41 moved from carried to other words; C43 moved from "could not check" to not carried as a measured number; C44 from "could not check" to other words. Nothing moved the other way.

## Corrections proposed

Each is a change the owner can accept or decline by number. "Now" is the text on `main` today (`ab8a434`); line numbers are there. The front page was rebuilt since the audited commit and its claim sentences are unchanged, at new lines. **The blog draft is the owner's to rewrite by hand; its sentences are listed in 25 and not touched.**

Three of these replace the sentence decision 0013 fixed (1, 2, 3). A new decision would have to say so; the driver drafts it once the owner has chosen the words.

**1. The status line.** `README.md:49`.
Now: "Twenty templates have each been proven in a recorded run, and one paired comparison has been made. On that evidence, grooph is shown to bound and record autonomous work and to hold a design as a runtime contract. It is not shown to raise quality over the same instructions given as a prompt, on small tasks"
Proposed: "Each of the twenty templates has a recorded run: eighteen pass the project's checks and two are published red. In those runs a session stopped where its graph said, at a passed bar or at a human gate, and left a record of what it did. No round cap or budget is on record as firing, so it is not shown that one holds a run that would otherwise go on. In a paired comparison on four small tasks the package showed no quality advantage over a prompt derived from it. [`docs/claims.md`](docs/claims.md) lists every claim, its evidence and its audit."

**2. The front page's three claims.** `apps/web/src/ui/landing/Landing.tsx:135` to `:143`.
Now: "**Every loop can end.** The validator refuses a loop without a stop, a critic that shares the builder's context, and an irreversible step without a human gate." · "**The graph is the contract.** The package drives the session as drawn: named subagents, stops checked in order, and gates that halt before anything irreversible." · "**Every run leaves a record.** Notes, rounds, dispatch counts and why it stopped, in a folder a monitor reads and a run id resumes."
Proposed: "**Every loop names its stop.** The validator refuses a loop without one and warns when a loop has no cap. Where a graph asks for it, it refuses a critic that shares the builder's context, and it refuses a step marked irreversible with no human gate before it." · "**The graph is the contract.** The package tells the session to run it as drawn: named subagents, stops in order, a halt at every human gate. grooph does not enforce it while it runs; eighteen of twenty recorded runs pass the checks of it, and two say why they do not." · "**Every run is asked for a record.** Notes, rounds and why it stopped, in a folder a monitor reads. A halted run goes on when a person answers."

**3. The front page's "what is shown".** `Landing.tsx:258` to `:260`.
Now: "In twenty proving runs and one paired comparison, grooph is shown to bound and record autonomous work and to hold a design as a runtime contract. It is not shown to raise quality over the same instructions given as a prompt, on small tasks. It does not run agents, host anything, or call a model."
Proposed: "In twenty recorded runs a session stopped where its graph said, at a passed bar or a human gate, and left a record; eighteen of the twenty pass the project's checks. No round cap or budget is on record as firing. In a paired comparison on four small tasks the package showed no quality advantage over a prompt derived from it. grooph runs no agent, calls no model and needs no hosted service." The link beside it goes to the claims page instead of decision 0013.

**4. The lede, twice.** `README.md:13` and `Landing.tsx:98`.
Now: "grooph checks that every loop can end and every critic can actually inspect something" · "grooph checks that every loop can end"
Proposed: "grooph checks that every loop names a stop and every bar names what a critic can inspect" · "grooph checks that every loop names a stop"

**5. The report's summary.** `docs/report/grooph-technical-report.md:7` and `:11` to `:15`.
Now (7): "every loop can end, every critic can see something the builder did not, every irreversible step waits for a person." Proposed: "every loop names a stop, a critic's bar names what it inspects, and a step marked irreversible has a person before it."
Now (11 to 13): "A package holds a design as a runtime contract in Claude Code. Twenty of twenty templates have a recorded run." · "A package bounds the work. In the one comparison run so far, the only run that went past its bounds was a prompt-only run." · "A package leaves a record that a monitor reads and a run id resumes."
Proposed: "In Claude Code a session followed its package in 18 of the 20 kept records, by the project's own checks of selected parts of each record; two are published red. The package instructs; grooph does not enforce." · "Recorded runs halted at human gates, and one at a periodic human check-in. No record shows a round cap or a budget firing. The first comparison's one run cut off by the dollar ceiling was inside the graph's own caps." · "A package asks for a record that a monitor reads. Halted runs were continued by resuming the same session."

**6. The report's table of what is refused.** `docs/report/grooph-technical-report.md:50` to `:53`.
Proposed: the three rows read "Every loop names a stop: a loop with no stop is refused; a loop with no cap draws a warning" · "A critic must be able to disagree: where the graph asks for isolation, a critic that shares the builder's context is refused" · "A person before a step marked irreversible".

**7. The report on adaptation.** `:38`. Now: "It may tighten a brake and never loosen one". Proposed: "Its brief tells it to tighten a brake and never loosen one; nothing in grooph refuses a loosened one, and a person sees the change when adopting the working copy."

**8. The report on the proving runs.** `:74` and `:76`.
Now: "Each of the twenty templates has a small task designed so the template's point can show, pre-registered before the run with the reason a first pass should fail, and one recorded headless run" · "$57.51 over 31 model-calling invocations" · "What the records show: the contract holds. Named agents ran as isolated subagents; stops were evaluated in order; every gate was a halt with nothing irreversible done. Back edges fired in six templates once the tasks carried evidence held out from the builder."
Proposed: "Each of the twenty templates has one kept headless run on a small task. Each task and its expected checks were committed before its run; the second batch also wrote down a design bet, and the last four a probability that a first pass would fail." · "$57.51 over 31 invocations, 30 of which reached a model" · "What the records show: in 18 of 20, named agents ran as their own subagents and the run ended as its graph says; the lead recorded checking its stops in order, and no run reached a point where the order mattered. Every kept record with a gate has a halt note at it. Two templates record a critic sending work back on reference evidence the builder was instructed not to read; a third records a held-out test doing so, and failed that reading rule; a fourth repairs an integration failure with nothing held out. Two other returning edges are the loop moving on to its next phase or piece. These show mechanisms, not what they are worth."

**9. The report on study one.** `:97` to `:103`.
Proposed: "**Result.** None of the four projects met its pre-registered test for the graph earning its cost. Three met their losing condition; `review-gate` met neither. Every arm reached the same held-out score within a project; three suites were saturated, and every `grind-loop` run missed the same one case of 62. No graph run was ranked first, in one judge call per project. This is not a test of equivalence." · "**Why.** The study set a compiled package against a prompt derived from it by rule. The prompt kept the roles, the routing, the loop sentence, the gate sentence and each brief; it dropped each agent's tool list, ownership and evidence rules, and the record. In all 18 prompt-arm runs the lead dispatched subagents for the roles. The prompt arms could also see grooph's name, in their repository's history and their list of skills; a scan of their transcripts found no use of either." · "**Where the arms differed.** One prompt run was cut off at the $9.00 ceiling ($9.02, 24 minutes 51 seconds), in its second attack round, inside the caps the graph also has. Its first red team had reported a failure the written contract covers, and its builder had revised the parser. Both graph runs ended at round 0 on a passed bar. No graph-arm back edge and no outer retry of the loop arm fired, and no cap or budget did." · "**Limits.** Two replicates per arm (three for one project); one harness version; one model family; the loop arm ran one iteration in every run; the package and the prompt differed in more than the record. It measured what the package cost on these tasks, not what a brake or a correction is worth."

**10. The report's other mention of bounding.** `:101`, last sentence, "Bounding is the one place structure showed." Proposed: delete; correction 9 replaces the paragraph.

**11. The report on study two.** `:105` to `:107` and `:142`. Now: "Study two, designed and not yet run" and "The comparison evidence is one study of four small projects." These are out of date on `main`: study two has run. Proposed: **hold**. Study two's claims have not been audited. Replace the section only after round two, with words that keep the distinction the driver held the owner to: no graph earned its cost over the same design said as prose; what ended above the task alone was the design, in either form.

**12. The field guide's "how to read it".** `scripts/field-guide.mjs` (it writes `docs/field-guide.md:40` and `:42`).
Proposed: the check "asks whether selected parts of the record match the graph (the named agents ran as their own subagents, the run ended as written, the notes are whole)"; and "As of study one, recorded runs stopped where their graphs said and left records; no cap or budget is on record as firing; no quality advantage over a prompt derived from the package was shown, on four small tasks."

**13. What the hook records.** `README.md:64`, `docs/subagents.md:150`, `docs/GLOSSARY.md:35`, `docs/HANDBACK-operator.md:151`, the header comments of `packages/cli/hooks/grooph-event.mjs` and `grooph-events-push.mjs` (both together: a test compares one with its installed copy), the `grooph hooks` help text in `packages/cli/src/commands/hooks.ts:40` and `docs/cli.md` generated from it, and `experiments/game/runs/README.md` (already corrected in pull request #89).
Now, in each: "ids, names and times", some with "never … a tool's input or result" or "cannot steer".
Proposed, in each: "ids, names and times, and on the machine it runs on the working folder's path and where a subagent's transcript is kept; never a prompt, a tool's input or output, or anything an agent said. It returns no decision to the harness." `docs/privacy.md` already says this, and is the page to match.

**14. The report on the sender.** `:113` to `:125`.
Proposed: "The same script has recorded runs in Claude Code and in Codex, where it needs a trusted folder and a reviewed hook." · "It runs at a turn's start and at its end, and during a turn when a tool call is recorded and ten minutes have passed. Before it sends, it shortens each line: a folder's name in place of its path, and no path to a transcript. It also sends a session's own notes and plans, written through the MCP server, with their text." · "It keeps a local summary of how the last push went; a missing events folder, a lock it gave up waiting for, or a status file it could not write leaves none." · "In one retained trial on GitHub, ten pushes started at once all arrived; the longest took 25 seconds and the most tries was ten." · "A turn's end leaves out files an earlier session left behind."

**15. The report on the map and on reports.** `:123`, `:131`, `:143`, `:144`.
Proposed: "The first cloud trial, as the session that ran it reported, sent nothing and said nothing" · "In the plan drawn for the push that produced this report, 9 of 19 handoffs were ones only a person could move, seven of them starting a session." · "Hooks that arrive mid-session are picked up, by Claude Code's documentation; in two reported trials three sessions of four did, then two of three."

**16. The sizes and times.** `docs/exports.md:70` stands. `docs/decisions/0021` is a decision record and is not edited; proposed is one line where the numbers are next published, and on the claims page: "172.4 KB is what the front page's address loads to show itself. After that the app fetches the rest so that it opens offline. The paint times were measured with that turned off, on one Mac with an emulated link."

**17. The validator's own sentence.** `packages/core/src/validate.ts:431` prints "a critic on a different tier or pin tends to catch different mistakes" (and `docs/rules.md:189` shows it). Proposed: "a critic on a different tier or pin may catch different mistakes". **This one is code, with fixtures and a generated page behind it.** It is listed for the owner's yes and is the driver's to give to a lane; it is not in the audit lane's pull request.

**18. The README's smaller lines.** `README.md:16` "It works on a phone, needs no account, and opens offline once it has been opened online." Proposed: "It is built for a phone's screen, needs no account, and opens offline once it has been opened online." `README.md:41` "It does not start the run until you say so." Proposed: "The skill tells the session not to start the run until you say so."

**19. A link to the claims page.** `README.md`, in the Docs list, and the page added to the site (`docs/claims.md`, already drafted on this branch).

**20. The graph document's page.** `docs/graph-ir.md:92` "everything else is hidden" → "the node is told to read nothing else". `:177` "the same run id resumes it" → "the same session is resumed, and told the run id". `:188` add: "This is the lead's brief. Nothing in grooph refuses a loosened brake; adopting a working copy shows the change to a person." `:298` "is read as interrupted" → "is flagged by the proving check; the monitor shows it as ended or running".

**21. The runs page.** `docs/runs.md:15` "One short line per dispatch; no other cost." → "One short line per dispatch."

**22. The field guide's and community page's design sentences.** `scripts/field-guide.mjs` for `:60`, `:65`, `:326`, `:676`; `docs/community.md:3`, `:13`. Proposed: "so it need not share the builder's blind spots" · "the builder is given only the traces" · "a same-model critic may keep approving the mistakes the builder makes" · "four reviewers and a judge are five dispatches a round" · "nothing marked irreversible is reached without a person" · "held-out cases the proposer is told not to read". The template descriptions live in `patterns/*.grooph.json`, which this lane may not edit: those four are the driver's to place.

> **Added on 2026-10-05, after the round, on the driver's ruling; the proposal above is kept as it was written.** One of these sentences will not be on `main` in the lane's words. "Four reviewers and a judge are five dispatches a round" fails `scripts/check-brake-values.mjs`, which refuses a count beside a brake's unit in a template's prose, and the check gets no exception for a correction. The house lane wrote "four reviewers and a judge are each a dispatch, every round", which says the same and passes; that is the sentence on `main` (pull request #108, with correction 17). The same change words the community graph's summary "held-out cases the proposer is told not to read", which is true of that graph: its proposer's brief says "Never open" the held-out folder. And the claim correction 22 answers still stands in three places it did not list, left alone for now: the `description` of the `red-team-loop` template ("The builder sees only the traces") and of the community graph ("A proposer, which never sees the held-out cases"), where a run reads the description, so changing it raises the template's version; and `docs/templates.md:142` ("builder sees only the traces"). They go into round two as places not yet corrected.

**23. The subagents page.** `docs/subagents.md:99` drop "on every hook" for Codex's model. `:101` "19 turn ends and 19 of them" → "20 such stops: 19 followed the session's 19 turn ends, one came during a turn". `:114`, `:50`, `:52`, `:58`, `:204`: relabel from "seen" to "reported by the session" where no recording is kept. `:126` "about 40 ms" → "as long as Node takes to start (not measured here)". `:127` add "the sender installed beside it is a longer script". `:192` drop "[tested against … a remote that never answers]"; keep "about thirteen seconds" as reported. `:194` drop the sentence on sixteen at one moment. `:198` drop "for the seventy minutes it went on working".

**24. The quickstart.** `docs/quickstart.md:24` "Each command ends with a `next:` line" → "Most commands end with a `next:` line when run in a terminal". `:34` "Every error says what to fix" → "An error says what is wrong, and most say what to fix". `:45` "CI runs it on every push" → "CI runs it on pull requests and on pushes to `main` and slice branches".

**25. The blog draft: reported, not changed.** The owner is rewriting `docs/blog/2026-10-loop-graphs.md` by hand. The sentences the audit would not publish as they stand: the headline claim (line 78, as correction 1); "make sure it can end" in the title and line 7 (correction 4); line 32 and 34 (correction 2); line 64 "built so its point could show"; line 66 "that prompt in a plain retry loop" (the loop ran once); line 68 and 70 (correction 9); line 80 "has not run yet" (it has); line 84 "Never a prompt, a file name, or a reply" (a transcript's path is a file name); lines 86 to 90, the map as "what moved" (it is a plan); line 98 "Three turns were lost" (reported); line 102 "Every line was read before I left it on" (the other project's session read them; the yes came first). And its first-person sentences are his to vouch for.

**26. Corrections attached to evidence, not made in it.** The write-ups under `experiments/comparisons/` and decisions 0012 and 0013 stay as written (decision 0009). Three of their statements are wrong by their own records: "its first red team wrote two traces … both beyond the README's contract" (`red-team-loop/README.md`); "the pre-registered losing condition was met" for `review-gate`, and "in three of three" for `spec-then-loop`; "No loop turned in 27 runs" (decision 0012, and the comparisons' index). Proposed: one dated note at the top of `experiments/comparisons/README.md`, added by the lane that owns that folder, pointing to this reconciliation; and the three statements corrected in whatever decision replaces 0013.

## Disagreements that remain

None on a finding. Two differences of emphasis, written down so they are not lost:

- **How much the gates carry.** Codex: "a recorded halt before the marked irreversible action is a real, limited boundary." The lane agrees, and adds that the prompt arms halted at the same gates when the prose told them to, so a gate is something a design buys in either form. Both would publish the gates as observed and neither would publish "bounds" on them alone.
- **Whether the plan's count is worth a sentence** (C40). Codex: publishable if labeled a plan. The lane: true, and a count on a plan says little without the count of what happened. The owner's taste decides.

## How close

**Converged.** Twenty-one findings, none disputed; fifty-two claims, one reading each. The judgment rests on this: where the two sides differed going in, one of them was checkably wrong in the records, and it was the lane three times and Codex not once. Where the lane had already narrowed a claim, Codex narrowed it the same way from its own reading of the files, and its notes hold its own re-derivations, not the lane's.

## Another round?

**Yes, one, after the owner has decided the corrections, and for two things only.**

1. The corrected words as they would be published: the diff of the corrections pull request. New words can overstate as easily as old ones.
2. Study two (pull request #97, on `main`): its two answers and the caveats its own handback lists. Its claims have been read by a fresh reader of the driver's and by nobody outside Claude Code.

Cost: one carry each way, and about four hours of Codex by the first round's clock. It should not start before the owner has chosen the headline words, since those are what it would read.

## Experiments designed, not run

- **A brake that binds.** Both sides agree no record shows a round cap or a budget firing, and that the claim "bound" needs one that does. Codex's design is adopted with two additions from the game experiment: [`../designs/a-brake-that-binds.md`](../designs/a-brake-that-binds.md). It is two tiny runs and needs the owner's yes. Passed to the driver.

Measurements both sides name, none needing a design: how long the event hook takes (the "40 ms"); what a first visit to the front page fetches with the service worker on; and a fresh session picking a halted run up from its folder by its id, which is one short model session and is the driver's to schedule.

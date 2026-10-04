# Audit 0001 · inventory of claims, with the lane's own reading

**Commit:** `dbc7a28` · **Written:** 2026-10-04, by the audit lane, before Codex saw anything · **Count:** 52 claims, C1 to C52, in eight groups.

A claim is a sentence about what grooph does to the quality, cost, speed or safety of work, or about what an experiment or a measurement showed (decision 0024). A sentence published in several places in nearly the same words is one claim; every place is listed. Line numbers are at the commit above.

Each row gives the claim in its exact words at its main place, every place it stands, and the lane's reading: **carried**, **other words** (carried with other words, or only under a condition the sentence does not give), or **not carried**. The reasoning, the evidence by path, what each command printed and the words the lane would publish instead are in the claim's block in [`round-01/HANDOFF.md`](round-01/HANDOFF.md), under the same number.

## The count

| Reading | Claims | How many |
|---|---|---|
| Carried | C4, C7, C9, C11, C13, C14, C16, C18, C22, C23, C24, C25, C26, C27, C28, C29, C33, C37, C41, C42 | 20 |
| Carried with other words | C2, C3, C8, C10, C12, C15, C17, C19, C20, C21, C30, C31, C32, C34, C35, C36, C38, C45, C46, C47, C48, C50, C51, C52 | 24 |
| Not carried as worded | C1, C5 (the README's word "proven"), C6, C39, C40, C49 | 6 |
| Could not be checked in this round | C43 (no record found), C44 (the paint times) | 2 |

## Commands run, and what they printed

All on 2026-10-04, in the lane's worktree at `dbc7a28` and again in the snapshot. None calls a model.

| Command | Printed |
|---|---|
| `node scripts/lib/prove-summary.mjs` | twenty rows; "20 records, $44.98 in all." |
| `node scripts/lib/compare-summary.mjs --index` | four rows; "**Spend:** $60.62 of the $100.00 cap across 40 invocations" |
| `node scripts/field-guide.mjs --check` | "docs/field-guide.md and docs/field-guide/ are current (20 templates, 18 checks passed, 2 failed)" |
| `scripts/prove-pattern.sh grind-loop --check experiments/patterns/grind-loop/run` | "PASS" |
| `node scripts/rule-reference.mjs --check` | "docs/rules.md is current" |
| `node scripts/perf-budget.mjs --check` | first load 172.4 of 180 KB; canvas address 270 of 276; embed 125.1 of 132; CLI cold start 102 of 400 ms |
| `node scripts/site-pages.mjs --check` | "site-pages: ok. 12 pages and an index, links and anchors resolve" (before the claims page was added) |
| `node tools/stops-fired.mjs` | "33 run records. Stops named in a note's stop field, by kind: {"bar-passed":18,"human":1}. Halts at a node: 14." |
| `node tools/comparison-facts.mjs` | "27 runs, $56.62 without judges. Ledger: 40 invocations, $60.62." · "Prompt-arm runs (B and C): 18; of those that dispatched at least one subagent: 18." · "Arm C runs: 9; of those with one lead session, that is one iteration of the loop: 9." |
| `bash tools/validator-probes.sh <folder>` | P2 (a loop with no cap and no budget): 0 errors, and it exports. P3 (shared context, no policy): 0 errors. P4 (the same with the policy): `E_CRITIC_NOT_ISOLATED`. P5 (told to merge, unmarked, no gate): 0 errors. P6 (the same, marked): `E_IRREVERSIBLE_NO_GATE` |
| `node packages/cli/bin/grooph.js validate handoffs/briefs/plan-2026-10-04/build.grooph-map.json` | "3 lanes · 9 sessions (10 counting families) · 1 person · 19 handoffs, 9 waiting on a person" |
| `git log --diff-filter=M` over the evidence folders | one commit changed files in place (`9f30231`, a re-proof); each of the four replaced records is byte-identical to its `run-1/` |

Not run: the browser tests, and `scripts/perf-loadtime.mjs` (it needs a browser).

## Group A · What grooph is shown to do

| # | The claim, in its words | Where | Reading |
|---|---|---|---|
| C1 | "grooph is shown to bound … autonomous work"; "A package bounds the work. In the one comparison run so far, the only run that went past its bounds was a prompt-only run."; "Bounding is the one place structure showed." | `README.md:47` · `Landing.tsx:183` · `docs/blog/2026-10-loop-graphs.md:70`, `:78` · `docs/field-guide.md:42` · `docs/report/grooph-technical-report.md:12`, `:101` · `docs/decisions/0013-value-as-of-study-one.md:12` | **Not carried.** No round cap or budget has fired in 33 run records. The one runaway prompt run was cut off by the runner's dollar ceiling, inside the same caps the graph has. Observed: runs stopped at a passed bar or a human gate |
| C2 | "… shown to … record autonomous work"; "Every run leaves a record. Notes, rounds, dispatch counts and why it stopped, in a folder a monitor reads and a run id resumes." | the headline's four places · `Landing.tsx:98` · report `:13` · decision 0013 `:13` | **Other words.** The record: yes, 33 of 33. Dispatch counts: kept in 10 of 20. Resuming: every resume on record is the same harness session, resumed. "Ten to fifteen lead turns": 3 to 17 |
| C3 | "… and to hold a design as a runtime contract"; "The graph is the contract. The package drives the session as drawn: named subagents, stops checked in order, and gates that halt before anything irreversible."; "What the records show: the contract holds." | the headline's four places · `Landing.tsx:94` · report `:11`, `:76` · decision 0013 `:11` · `docs/field-guide.md:40` | **Other words.** 18 of 20 kept records pass the check; 4 more pass on a second run. "In order" is the lead's own note and never decided anything. One instruction did not hold |
| C4 | "It is not shown to raise quality over the same instructions given as a prompt, on small tasks." | `README.md:47` · `Landing.tsx:184` · blog `:78` · field guide `:42` · report `:15`, `:137` | **Carried.** Every arm was at the top of its held-out suite, so "could not tell" is the exact reading |
| C5 | "Twenty templates have each been proven in a recorded run" | `README.md:47` · `Landing.tsx:117`, `:146`, `:183` · report `:11` · blog `:64` · field guide `:44` | The README's "proven" is **not carried**: two of twenty fail their check. The other places say "has a recorded run" and are carried |

## Group B · The proving ground

| # | The claim, in its words | Where | Reading |
|---|---|---|---|
| C6 | "Each of the twenty templates has a small task designed so the template's point can show, pre-registered before the run with the reason a first pass should fail" | report `:74` | **Not carried.** Pre-registered: 4 of 20. A design bet written before the run: 11 more. Neither: the first 5 |
| C7 | "Each record holds the run id, the rounds, which stop fired, how the run ended, the cost as the harness reported it, and a `--check` that re-asserts the outcome from the evidence." | report `:74` | **Carried** |
| C8 | "The proving ledger stands at $57.51 over 31 model-calling invocations." | report `:74` | **Other words.** 31 invocations; one failed at sign-in before any model call |
| C9 | "Records that came back red are published red, with the reason."; "Evidence is never edited by hand" | report `:74`, `:158` · blog `:64` | **Carried.** The commit history bears it out |
| C10 | "Back edges fired in six templates once the tasks carried evidence held out from the builder." | report `:76` · decision 0013 `:14` | **Other words.** Two were a critic's correction on held-out evidence; two a check's; two were the loop moving on |
| C11 | The field guide's twenty "Proving run" blocks | `docs/field-guide.md:81` to `:861` | **Carried.** Generated from the records; the check passes |

## Group C · The paired comparison

| # | The claim, in its words | Where | Reading |
|---|---|---|---|
| C12 | "Four templates, one designed project each, three arms under equal conditions"; "Twenty-seven runs, 40 invocations with judges, $60.62." | report `:80`, `:88` · `README.md:47` · `Landing.tsx:183` · blog `:66` | **Other words.** The counts re-derive and the recorded conditions are equal. Unsaid: the loop arm ran one iteration in all 9 of its runs |
| C13 | The table of the four projects | report `:90` to `:95` | **Carried.** Every cell re-derives |
| C14 | "The graph did not earn its cost in any of the four projects, by each project's own pre-registered test. Every arm reached the same held-out score in every replicate. The judge never placed a graph run first." | report `:97` · blog `:68` | **Carried.** The losing conditions were committed before the runs |
| C15 | "In all 27 runs the prompt-arm lead dispatched the roles as separate subagents." | report `:99` | **Other words.** 18 prompt-arm runs, and all 18 did |
| C16 | "One prompt run went on to the $9.00 ceiling ($9.02, 24 minutes 51 seconds) while both graph runs of that project stopped by the graph's own edge." | report `:101` · blog `:70` | The numbers are **carried**. What they are evidence of is C1 |
| C17 | "Two replicates per arm (three for one project); one harness version; one model family; tasks a strong builder finishes in one pass, so no loop turned. It measured the structure's overhead and its bounding, not its correction." | report `:103` | **Other words.** Add: the loop arm ran once; every arm was at the ceiling. "And its bounding" falls with C1 |
| C18 | "Study two, designed and not yet run" | report `:105` to `:107` · blog `:80` | **Carried** |

## Group D · The validator and the compiler

| # | The claim, in its words | Where | Reading |
|---|---|---|---|
| C19 | "grooph checks that every loop can end"; "Every loop can end. The validator refuses a loop without a stop" | `README.md:11` · `Landing.tsx:66`, `:90` · report `:7` · blog `:1`, `:7` | **Other words.** The rule asks for one stop of any kind. A loop with no cap and no budget is a warning, and exports |
| C20 | "The validator refuses … a critic that shares the builder's context" | `Landing.tsx:90` · `README.md:11` · report `:7`, `:51` · blog `:32` | **Other words.** Only where the graph carries a critic-isolation policy. The design skill does not name the policy |
| C21 | "The validator refuses … an irreversible step without a human gate"; "every irreversible step waits for a person" | `Landing.tsx:90` · report `:7`, `:53` · blog `:34` | **Other words.** Only a step the author marked irreversible. Two of twenty templates mark one |
| C22 | "Thirty-five rules, 24 for graphs and 11 for maps, each with a stable code and a fixture that fires it" | report `:44` · blog `:36` | **Carried.** 35 rules, 30 distinct codes |
| C23 | "Patterns in the built-in library must validate clean, and CI checks that they do." | report `:56` | **Carried.** Clean means no error and the listed warnings |
| C24 | The output of `grooph explain` for the review gate | blog `:40` to `:50` | **Carried.** Word for word |
| C25 | "grooph never runs an agent, never calls a model" | `README.md:12` · `Landing.tsx:67`, `:184` · report `:7`, `:135` · blog `:7`, `:54`, `:121` | **Carried** |

## Group E · The app

| # | The claim, in its words | Where | Reading |
|---|---|---|---|
| C26 | "Graphs live in this browser on this device. Nothing is sent anywhere." | `Landing.tsx:190` · `README.md:12` · report `:136` · blog `:115` | **Carried.** A share link or an embed carries the graph in the link itself |
| C27 | "It works on a phone, needs no account, and opens offline once it has been opened online." | `README.md:14` | **Carried**, on the tests' word; the browser suite was not run here |
| C28 | "Here is one of the twenty recorded runs, as it happened." | blog `:72` · the front page's recorded run | **Carried.** The same payload in both places; it matches the record's notes |
| C29 | "It does not start the run until you say so." | `README.md:39` | **Carried** as what the skill instructs. No record of a session obeying or not |

## Group F · Observation

| # | The claim, in its words | Where | Reading |
|---|---|---|---|
| C30 | "a hook that records ids, names and times, never content"; "Never a prompt, a file name, or a reply." | `README.md:62` · `Landing.tsx:165` · report `:113` · blog `:84` · `docs/subagents.md:150` | **Other words.** Never content: yes. The local file also holds the working folder's path and the path of a subagent's transcript |
| C31 | "It prints nothing, exits 0 whatever happens, and returns nothing a harness reads: observation never steers." | report `:113` · `README.md:62` | **Other words.** True of the script. The installed command fails when the file or Node is missing. A lead can read what the hook saw through grooph's own MCP tool |
| C32 | "The same hook runs in Claude Code and in Codex." | report `:113` | **Other words.** In Codex it needs a trusted folder and a reviewed hook, and some events are missing |
| C33 | "a session silent for half an hour reads "last seen", not "working"" | report `:115` | **Carried** |
| C34 | "It runs at a turn's start, at its end, and at most every ten minutes during a turn. Before it sends, it puts each line in a smaller form" | report `:119` | **Other words.** The send during a turn needs a recorded tool call. A lead's own notes are sent with the events, text and all |
| C35 | "A turn's end sends only its own session's files." | report `:125` | **Other words.** Also any file with a line since the session began, and any file already on the branch |
| C36 | "Every push now records how it went in a file beside the events." | report `:123` | **Other words.** Not when there is no events folder, or when it gives up waiting for a lock |
| C37 | "Ten pushes started in the same instant to one branch on GitHub all arrived, the last after 25 seconds on its tenth try" | report `:124` | **Carried.** One run |
| C38 | "The first cloud trial sent nothing and said nothing"; "Three turns were lost without a sign." | report `:123`, `:143` · blog `:98` | **Other words.** A report from another project's session, with no recording here |
| C39 | "On the first day five of them sent 163 lines: ids, tool names, times and a folder's name, and nothing else. Every line was read before I left it on." | blog `:102` | **Not carried.** The reading was another session's, reported; the owner's yes came before the lines; a line holds more fields than listed |
| C40 | "For the two-day push that produced this report the count was 9 of 19."; "Nearly half of what moved in my own operation moved only when I carried it." | report `:131` · blog `:86` to `:90` | The number is carried. What it counts is **not**: the map is a plan drawn before the push, with lanes that did not run |
| C41 | "Hooks that arrive mid-session are normally picked up and sometimes are not." | report `:144` | **Carried**, on documentation and a report, for Claude Code |

## Group G · Performance

| # | The claim, in its words | Where | Reading |
|---|---|---|---|
| C42 | "The embed's first load is 125 KB compressed" | `docs/exports.md:70` | **Carried.** 125.1 KB |
| C43 | "about 40 ms, the time Node takes to start" | `docs/subagents.md:126` | **No record found.** A second reader timed the hook at 53 to 71 ms |
| C44 | The table of sizes and paint times | `docs/decisions/0021-what-an-address-loads.md:27` to `:36` (not on the site) | Sizes **carried** to the decimal. Paint times **not re-derived** |

## Group H · The other pages the site renders

| # | The claim, in its words | Where | Reading |
|---|---|---|---|
| C45 | "It may tighten a brake and never loosen one"; "Brakes are not adaptable." | report `:38` · `docs/graph-ir.md:171` | **Other words.** A rule the brief states and the proving check looks for afterwards. Nothing refuses a loosened brake |
| C46 | "everything else is hidden"; "the builder sees only the traces"; "held-out cases the proposer never sees" | `docs/graph-ir.md:91` · `docs/field-guide.md:65` · `docs/community.md:13` · blog `:11` | **Other words.** An instruction, which failed once on record |
| C47 | "the same run id resumes it" | `docs/graph-ir.md:160` | **Other words.** As C2 |
| C48 | "is read as interrupted" | `docs/graph-ir.md:276` | **Other words.** By the proving check only; the monitor has no such state |
| C49 | "a critic on a different tier or pin tends to catch different mistakes"; "so it does not share the builder's blind spots"; "a critic that starts fresh is worth more than one that was told what the builder thinks of its own work" | `docs/rules.md:189` (printed by the validator) · `docs/field-guide.md:60`, `:325` · `docs/subagents.md:70` | **Not carried** as findings. Design beliefs, not measured here |
| C50 | "small enough for a model to read and rewrite in one pass" | report `:29` · blog `:24` · `docs/rules.md:293`, `:435` | **Other words.** A design limit, not a measurement |
| C51 | "One short line per dispatch; no other cost." | `docs/runs.md:15` | **Other words.** The record as a whole is the package's one measured cost |
| C52 | Ten smaller sentences, listed in the handoff | `docs/subagents.md:99`, `:101`, `:114`, `:126`, `:127`, `:192`, `:194`, `:198` · `docs/community.md:3` · `docs/quickstart.md:24`, `:34`, `:45` · `docs/field-guide.md:673` | **Other words.** Wording fixes; none blocks a claim of value |

## How the reading was made

The lane read the published pages and the evidence itself for groups A to E and G, and wrote the three scripts in `tools/`. Two subagents, started with the model set to Opus, read in parallel: one swept the site's other pages for claims (group H), one checked the observation claims against the code and the records (group F). The lane checked the main points of both against the source before using them; where a row stands on a subagent's word alone, the handoff says so. No model session was started by command, and no experiment was run.

One thing the lane did not expect: the largest finding lowers the sentence decision 0013 set as the ceiling. That decision says grooph "is shown to bound and record autonomous work". The records carry "record" and "stopped where the graph said". They do not yet carry "bound".

# Audit 0001 · every claim grooph publishes as of 0.3.0

The first audit under decision 0024. Its subject is everything grooph says about itself in public as of version 0.3.0: the README, the front page, the pages the site renders, the technical report and the blog draft. Nothing in them had been read by a second harness before.

- **Commit under audit:** `dbc7a281f977dddf7acc7948a0221e2aba93c5e4` (`main` on 2026-10-04). It is eleven commits after the tag `v0.3.0`; those commits changed spelling in the audited files and no claim. It was chosen over the tag because it is what the site serves, and corrections are made against it.
- **Snapshot:** `/Users/noir/Documents/grooph-exchange/snapshots/0001-claims-as-of-0-3-0/`, a detached worktree at that commit, installed and built.
- **Audit lane:** a Claude Code session on Opus 5.5 (slice 0075). **Auditor:** Codex with GPT-6.1 Sol, opened by the owner on `/Users/noir/Documents/grooph-exchange/codex/0001-claims-as-of-0-3-0/`.
- **State:** round 1 is reconciled (2026-10-05): 21 findings, none disputed. The owner accepted all seven of its decisions that day, and its corrections are on `main`, one commit each (pull request #105, merged as `1574c53`). Round 2 is written and not sent ([`round-02/HANDOFF.draft.md`](round-02/HANDOFF.draft.md)): the corrected words, comparison study two, decision 0029, the brake experiment's design, and the comparison of brakes that `grooph adopt` was put on in answer to finding F6. The owner granted the round once; it goes out when that comparison holds a check's verdict, which he ruled a brake on the lane's observation. Not ended.

## What is here

| File | What it is |
|---|---|
| [`inventory.md`](inventory.md) | Every claim, with an id, its exact words, where it stands, its evidence, and the lane's own reading before Codex saw anything |
| [`tools/`](tools/) | Fifteen small scripts written for this audit. They read the records and call no model. Each says at its top how to run it. Three read the studies' transcripts, which are kept only on the Mac that ran them (`prompt-arm-context.mjs`, `cost-by-file-second-route.py`, `study-two-context.mjs`) |
| [`round-01/HANDOFF.md`](round-01/HANDOFF.md) | What the lane asked Codex to read and attack |
| [`round-01/HANDBACK.md`](round-01/HANDBACK.md) | What Codex found: 21 findings, what it checked and found sound, what it could not check, and a design for the one experiment it says is needed. Its main receipts are in `round-01/notes/`; the rest of its working notes stay in the exchange folder |
| [`round-01/RECONCILE.md`](round-01/RECONCILE.md) | The lane's answer to each finding, one reading for each of the 52 claims, and 26 numbered corrections for the owner to accept or decline |
| [`round-02/lane-notes/`](round-02/lane-notes/) | What the lane ran itself for round two. So far: the adoption probe again, after pull request #114, a probe of what the comparison of brakes does with a check that judges a loop, a scan of study two's transcripts, and a probe of the irreversible rule at the start of a run. The house lane's own probes of the comparison are beside them in [`round-02/brakes-probes/`](round-02/brakes-probes/) |
| [`designs/a-brake-that-binds.md`](designs/a-brake-that-binds.md) | The experiment both sides say is needed before "bound" can be claimed: designed, not run, passed to the driver |

The public register of claims is [`docs/claims.md`](../../../docs/claims.md).

## The lane's reading, in short

Counted before Codex saw anything, and open to its attack. The inventory has the reasons.

- **The largest finding.** "grooph is shown to bound … autonomous work" is published on the README, the front page, the blog draft, the field guide and the report, and is not carried as worded. In 33 recorded package runs the only stops that fired were a passed bar (18 times) and a human check-in (once); no round cap or budget has fired on record. The comparison's one runaway prompt run was cut off by the runner's dollar ceiling while inside the same caps the graph has. What is observed is that runs stopped where the graph said, at a passed bar or a human gate.
- **Not carried as worded:** the README's "proven" (two of twenty records fail their own check); the report's "pre-registered before the run with the reason a first pass should fail" for all twenty (it holds for four); the blog's "Every line was read before I left it on"; the count of 9 handoffs in 19 presented as what happened (it is a count on a plan).
- **Carried with other words:** the contract claim (18 of 20, stops "in order" by the lead's own note); the record claim (dispatch counts in 10 of 20); "every loop can end", "a critic that shares the builder's context" and "an irreversible step" (each depends on something the author writes); "back edges fired in six templates" (two were corrections on held-out evidence); "ids, names and times" (the local file also holds two paths).
- **Added before Codex opened the round:** study one's prompt arms were not blind to the tool. All 18 sessions were shown the `grooph-design` skill by name and a commit that says "remove the package: this arm runs on the derived prompt alone"; none used the skill or the command. Found by the evidence lane, checked here in the transcripts. It limits what those arms can be called and changes no number.
- **Carried:** the negative result of the comparison and every number in its table; that evidence is never edited; that grooph calls no model and sends no graph anywhere; the rule count; the sizes in the performance budget.

## Held for the reconciliation

From the driver, 2026-10-04, after reading round one:

- No page changes until the rounds converge. The README's link to the claims page goes in the corrections pull request.
- C30 has one more place once it is on `main`: `docs/privacy.md`, a new page from another lane, which said "ids, names and times" and is being corrected there.
- **More places for C30**, found by the house lane (slice 0081) and confirmed on `main` at `dc8a67c`. Besides `README.md:62` and `docs/subagents.md:150`, the phrase "ids, names and times" (or "never a tool's input or result") stands in: `docs/GLOSSARY.md:35`; `docs/HANDBACK-operator.md:151`; the header comments of `packages/cli/hooks/grooph-event.mjs` (line 12) and `packages/cli/hooks/grooph-events-push.mjs` (line 51), one of which a test compares with the installed copy, so both change together; the `grooph hooks` help text (`packages/cli/src/commands/hooks.ts:40`), from which `docs/cli.md:437` is generated (`node scripts/cli-reference.mjs` after the change); and amendment A-012's own words in `spec/AMENDMENTS.md`. An amendment is not edited: the correction there is a new amendment row, proposed in the reconciliation for the owner, and is not part of the corrections pull request.
- **What a line holds beyond ids, names and times**, as the house lane found it and as C30 and C34 already say in part: the working folder's path and a subagent's transcript path; one fact from a tool's result (`spawned`, the id of the subagent that tool started); with `--tools`, the name of every tool called, and an MCP tool's name shows which service a session is connected to. Beside the hook's files, `grooph mcp` writes `said-<session>.jsonl` when a session declares a plan or leaves a note: free text, with the project's path. A push sends plans and notes too and drops the two paths; on a public repository the branch is public. The house lane's table is in `handoffs/0081-house-and-pages/HANDBACK.md` once pull request #56 merges.
- **The FAQ (pull request #54, branch `slice/0081-faq`) is held for this audit**: three of its answers repeat the wording of C1, C5 and C19. Its wording is settled with the rest when the rounds converge.
- The paint times in decision 0021 (C44) stay "not re-measured this round". No browser run is started for them.
- A decision that supersedes 0013 is the owner's. The driver drafts it once Codex and the lane agree on the wording of C1.

## Round 1, as it came out

Codex agreed with most of the lane's narrowing and corrected the lane three times; the records bore Codex out each time.

- **A correction cycle did turn in study one** (F1): in prompt run B-1 a red team reported a failure the written contract covers, the builder revised, and a second red team attacked. The lane had repeated the write-up's "two traces outside the contract" and decision 0012's "no loop turned in 27 runs".
- **`review-gate` did not meet its pre-registered losing condition** (F2): its second prompt replicate cost more than its second graph replicate. No project met its test for the graph earning its cost; three met their losing condition; one met neither.
- **One suite was not at its ceiling** (F5): every `grind-loop` run scored 61 of 62.

The lane added one observation to a point Codex could only reason about: `grooph adopt --write` accepts a working copy whose round cap and budget were raised (`tools/adopt-probe.sh`).

*Note, 2026-10-05, after the round:* pull request #114 answered that observation in code. The same probe at the merged code is refused, and the copy is written only when the change is asked for by name ([`round-02/lane-notes/adopt-probe-after-114.txt`](round-02/lane-notes/adopt-probe-after-114.txt)). The round's reading of 0.3.0 stands as it was agreed. The refusal is a new claim, read inside Claude Code only, and is part E of round two's draft. Four sentences that said "nothing refuses" were changed so as not to be untrue on `main`: the graph document page's (in the merge), the claims page's row for C45, the report's row for adaptation, and the proposed decision 0029.

After the round: 12 claims carried, 33 carried with other words, 7 not carried as worded. The owner did not carry Codex's prompt back; the lane found the handback on disk on 2026-10-05. One carry out, none back.

## How it ended

Not yet.

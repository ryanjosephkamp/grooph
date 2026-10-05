# Handback 0076 · The Codex compile target — review fix pass

## Second fix pass, 2026-10-05: who did what

**This section is by a Claude Code lane (Opus 5.5), not by Codex.** The driver gave the second fix pass to a lane of its own on the owner's word. Everything below this section is Codex's handback of 2026-10-04, left as Codex wrote it; where a sentence there is no longer true, this section says so.

**Branch:** `slice/0076-codex-target-second-pass`, made from Codex's `slice/0076-codex-target` at `68c1dfe`. Codex's eight commits are carried unchanged (`03018a5`, `a92cc7d`, `1f6fdbb`, `eae6813`, `3de4a92`, `ff23613`, `be9f55b`, `68c1dfe`); nothing was pushed to Codex's branch, and `~/Documents/grooph-codex` was not opened. On top of them: two merges of `main` (`48ac54e` at `1574c53`, `6e431cb` at `7c0a6df`: main moved again while the pass was open) and the lane's commits `ea09a0e` (item 2), `db2e74c` (item 1), `6f4e98f` (the transcript files), `d4a0b2a` (item 3), `f10ca4f` and `6a47120` (what the second merge and my own CI step needed), `862a081` (what my reader found), and this section. The pull request supersedes #70.

**Status:** `done` for the review's second read; `blocked` as before on criterion 5, the one proving run in Codex, which is the owner's to start in Codex. No model session was started and no proving run was made in this pass.

### Item 1. A package is one harness's files

**The decision: refused, not warned, the same way for both targets.** `compile()` refuses a document that names one harness when the export is for the other, under `E_NO_TARGET`, with one sentence for both directions:

```text
error  E_NO_TARGET  the document names the harness "codex" and the export is for "claude-code": export it for codex, or name claude-code in the document first (grooph apply <file> --ops - --write, given [{"op":"setTarget","harness":"claude-code"}])  [at: review-loop]
```

Why refused:

- The document already says which harness it is for. The app exports for it and offers no second choice; `grooph pick` and `grooph adopt` print `--target` from it. On the command line the two are said in two places, and when they disagree one of them is a mistake that grooph cannot settle.
- A package for another harness would carry a copy of the graph that names a harness the package is not for, and the outline's "Runs in", the picture's caption and the next run's `grooph adopt` line would say the same wrong thing.
- It is what `main` did with the case in the review (refused, `E_NO_TARGET`), so no brake is looser than it was.
- Refusing now can be loosened to a warning later without breaking anyone. The reverse cannot.

And, separately, the Claude Code writer uses the Claude Code profile whatever harness the document names (`packages/core/src/compile/claude-code/context.ts`), as the Codex writer already used its own. Either change alone closes the case; both are in, and each is tested without the other (`compileClaudeCode` and `compileCodex` called directly, as `compile.test.ts` calls them).

**The test that fails on `68c1dfe`:** `packages/core/test/compile-target.test.ts`, 13 tests. Copied onto `68c1dfe` and run there, 11 fail and 2 pass (the two that hold there: the fixture names Claude Code, and the Codex writer already used its own profile). The case itself, by command, at both heads:

| | `68c1dfe` | this head |
|---|---|---|
| `review-loop` naming `codex`, `grooph export --target claude-code` | exit 0; two agent files with `model: gpt-6-luna` and no `tools:` line | exit 1; the line above; nothing written |

**What follows from refusing, said plainly:**

- **A graph made from a built-in template names Claude Code, and needs one op before it is exported for Codex** (`setTarget`; or the graph inspector's harness choice in the app). `grooph template use` has no `--target`. That is a step more for an agent building a Codex package from a template by name. I did not add the option: it is outside the review's three items. It would be a small slice. The design skill's last step (`plugins/grooph/skills/grooph-design/SKILL.md`, step 7) exported "for this harness" without saying so; it has one sentence more now.
- **The handoff's own verification command is refused now.** `HANDOFF.md`, "How to verify", exports `fixtures/valid/review-loop.grooph.json --target codex`; the fixture names Claude Code. The handoff is left as written; CI's golden step is the command that holds now.
- **A mismatch is not seen until export.** `grooph validate --for-export`, the MCP validate tool and `grooph pick` are not told which export is asked for, so each passes a document that `grooph export --target <the other>` then refuses. `pick` and `adopt` print the right `--target`, so a person who follows them does not meet it.
- **The game experiment.** Its protocol compiles `arena.grooph.json` once for each harness and says: "If the Codex compiler needs the document to name its harness, that one line differs and the difference is in the record" (`experiments/game/PROTOCOL.md`, section 2). It does need it now, so the Codex run's graph differs from the Claude Code run's by that one line. The Claude Code run's starting contents are untouched: `experiments/game/setup/make-repo.sh --out <a scratch folder outside the clone>` prints the tree `3238a9052ce7765c79990029bbff6bccd88628bf` at this head.
- **The rule's row in `docs/graph-ir.md` changed** (the handoff allows it "where a rule's text names targets"): `E_NO_TARGET` now also covers an export asked for a harness the document does not name, reported by the compiler, since the validator is not told which export is asked for. No new code, no new fixture folder: a fixture cannot say which export is asked for, so the case is held by tests. `docs/rules.md` and `docs/cli.md` are generated from it and from the export's help, and both are pages on the site.

### Item 2. Main has moved

- `packages/core/test/graph-units.test.ts` now does what `compile.test.ts` does: it asserts that `compile()` refuses the document made in code (`E_SCHEMA` at `/groups/0/from`), then calls the writer behind it without the check, for both targets. The guard in `compile()` is untouched.
- The "Units" table is one function in a file of its own, `packages/core/src/compile/units.ts`, which both lead briefs end their section on the nodes with. Neither target has a copy of the words. A test compares the Codex table with the Claude Code one for the subgrooph fixture and the composed graph.
- **What else the two merges broke, and what was done:**
  - CI's golden step exported the fixtures (which name Claude Code) for Codex: it now names Codex in a copy first, by the op. My first version of it left that copy where the next step's `grooph new` writes; found by running the build job's steps in order before pushing, and fixed (`6a47120`).
  - Main reworded a validator warning (#108, "tends to catch" is now "may catch"). The lead's brief quotes it, so the Codex `review-loop` `LEAD.md` golden moved by those two words (`f10ca4f`), as the Claude Code one did on main.
  - Nothing in `grooph adopt`'s refusal (#114, #117) needed a change here: it prints `--target` from the adopted document's own harness, which is what the refusal expects.

### Item 3. Which approval policy applies is unknown until a run shows it

"Inherits the owner's approval policy" is gone from `MAPPING.md`, from every agent file and from `docs/targets/codex.md`. What is true by construction is said as that (the package sets no approval policy: no `approval_policy` key, no approval option in the command); what nobody has seen is said as unknown (which policy then applies, to the lead under `codex exec` and to the agents it spawns). The document's row marks its three parts apart, says what it said until today, and lists the question among what the proving run must establish. `PROVING-COMMAND.md` has the one sentence corrected and dated, and nothing else changed on that page. `experiments/patterns-codex/review-gate/README.md` said "the owner's policy applies" too, and no longer does.

**Sentences in Codex's handback below that this supersedes:** "Mapping/docs explain owner policy" (the table, item 1), "Owner settings apply" (decision 2) and "The runner inherits approvals" (what changed). Read each as: the package sets none, and which applies is unknown until a run shows it.

One sentence is new and is an instruction, not only a correction. An agent file now says: "This file sets no approval policy, and this package does not know which one applies. Assume no person is asked before a command of yours runs: run only what your capabilities allow." My first wording ("do not count on being asked") had the wrong subject, as my reader said: the worker is never the one asked, and it could be read as leave to proceed. If you would rather the file said only that it does not know, the second sentence is the one to remove.

**What "unknown" rests on, and does not.** No run on grooph's record shows which policy applies. I did not read OpenAI's documentation for what `codex exec` uses when no policy is given, and the document says so in the row. And the proving runner starts Codex with a command of its own (`scripts/prove-codex.mjs`: the prompt as an argument, `--json`, `--model`, a thread cap), not the one `MAPPING.md` suggests (the kickoff on stdin): the proving run will show what applies to the runner's command, and to the package's only as far as the two agree. That was so before this pass; nobody had said it.

### The transcript files

`scripts/prove-codex.mjs` writes `codex-output.jsonl` and `codex-stderr.txt` under `run/local/`, and `.gitignore` keeps `experiments/patterns-codex/**/local/` out, as it keeps the raw transcripts beside the other experiment records. (My first line named a folder called exactly `run`; the runner refuses to write over `run/`, so a failed record gets moved aside, and `run-1/local/` was not ignored. My reader found it.) The ledger keeps the two checksums, so a kept record can be matched to the file on the machine. `--check` reads the output from `local/`, or beside the record once a person has read it and moved it there, and says where it is kept when it is not here. A test asks `git check-ignore` about both paths, and about a run's folder moved aside.

**Not asked for, and not done:** the runner also keeps, where git takes them, files that hold what a session wrote and nobody has read yet: `project.diff` (every untracked file of the scratch project, whole) and the lead's `runs/` folder. They are the run's products, not its transcript, and the review named two files. A person should read them before the record is committed, as with the transcript. And `--check` on a clone without `local/` stops with a message and a stack trace: only the machine that ran it can check a committed record until the output is moved beside it.

### The golden packages

**Claude Code: unchanged by a byte.** `git diff origin/main -- fixtures/golden/claude-code` is empty at this head, and `pnpm --filter @grooph/core run golden:write` leaves the tree clean.

**Codex: both regenerated**, by the golden writer, which now writes them (they were made by hand through the CLI before). What moved, against `68c1dfe`:

| File | What moved |
|---|---|
| `review-loop/…/graph.grooph.json`, `fix-until-green/…/graph.grooph.json` | one line each: `"harness": "codex"` (item 1) |
| the three agent files (`review-loop--builder.toml`, `review-loop--critic.toml`, `fix-until-green--fixer.toml`) | two sentences each, on the approval policy (item 3) |
| the two `MAPPING.md` | three sentences each, on the approval policy (item 3) |
| `review-loop/…/LEAD.md` | two words, main's rewording of the warning it quotes |
| both `KICKOFF.md`, `fix-until-green/…/LEAD.md` | nothing |

Neither golden graph has a subgrooph, so the Units table is in neither golden `LEAD.md`; the test named under item 2 holds it. A third Codex golden, of the composed graph, would put the table in front of a reviewer; I did not add one unasked.

### Outside the handoff's list of allowed changes, each for a reason

- `plugins/grooph/skills/grooph-design/SKILL.md`: the one sentence in step 7 (item 1). The skill is linked into this Mac's `~/.claude/skills`, so it is live on merge.
- `packages/core/src/compile/claude-code/context.ts` and `lead.ts`: the review names the first; the second is the Units table moving to the file both briefs read. The Claude Code output is unchanged by a byte.
- `packages/core/src/compile/units.ts` (new), `packages/core/src/dev/write-golden.ts` (it writes the Codex goldens now).
- `.gitignore`: the line for the transcript files.
- `.github/workflows/ci.yml`: beside the golden step (allowed), **a new step that runs `scripts/prove-codex.test.mjs`**. Nothing ran the runner's tests before: Codex's "runner tests 6/6" were run by hand. The step starts no Codex and no model. Strike it if a workflow change is not wanted here; the test of where the transcript goes is then run by hand too.

### Found beside the task

- **`GROOPH_MODELS` crosses harnesses.** (Since decided by the driver and changed: see "After the driver's reader" below. What follows is as it stood at `0b67de3`.) Not in this diff, and not changed. The variable names the tiers for every export on a machine. With `GROOPH_MODELS=frontier=opus,strong=sonnet,fast=haiku`, a Codex-named review loop exported for Codex gets `model = "sonnet"` in both agent files and `-m 'opus'` in the suggested command (my reader ran it). The export does print "Named by GROOPH_MODELS", the proving runner deletes the variable, and `make-repo.sh` unsets it; a hand export for Codex on a machine that sets it for Claude Code is not protected. It wants a decision (one map per target, or a refusal), not a patch from this pass.
- **`hasProfile()` answered true for `constructor`** and every other word an object answers to (`harness in PROFILES`). A document naming one passed the validator and crashed the compiler (exit 2, on `main` too). It reads its own entries only now, and such a document is refused as one whose harness has no profile. Tested.
- **`scripts/prove-codex.test.mjs` was in no CI step** (above).

### A mistake of mine in this pass

To check `ci.yml`'s build job step by step I ran a script that executes its `run:` lines. Its cut-off was wrong and it ran on into the browser job: `pnpm --filter @grooph/web test:e2e` with no `GROOPH_E2E_PORT`, whose default is **4173**, the port I am told never to use. The suite served there for about three minutes around 15:00 ET. It passed, and its server starts with `--strictPort`, so nothing else was listening there then; I stopped nothing; nothing is listening there now. No browser was downloaded. The driver was told at once.

### A fresh reader

An Opus 5.5 subagent, given the diff of the lane's commits and the review's text, told not to read the commit messages or this file first, working in a clone of its own at `d4a0b2a`. It started no model and no server.

- **Item 1: it could not break it.** Eighteen harness values against both targets (absent, null, empty, whitespace, `Codex`, `codex ` with a trailing space, `constructor`, `__proto__`, numbers, arrays, a getter that changes its answer): each is refused or exports with the target's own models. Only `export.ts` compiles in the CLI; the MCP server has no export; the app takes the target from the document. It copied the new test onto `68c1dfe`: 11 of 13 fail, for the reasons the test names. Reverting the profile line, the refusal, the own-entry check, the Units call or the agent-file sentence each fails tests.
- **What it found**, all acted on in `862a081` or said above: main had moved again (merged, `f10ca4f`); the ignore line; the message's op not in the form the command takes; the help exporting one file for both harnesses; the skill's step 7; the agent-file sentence's subject; "this command has not been run" in `MAPPING.md`; the handback not yet written; a mismatch not seen until export; `GROOPH_MODELS`; the other kept files; a refusal asserted without its code.
- **What it did not check**: the browser tests, `first-run.sh`, the pages the mapping cites, whether `codex` is on PATH where the proving command would run, `grooph adopt` on a run whose working copy changed its harness (from reading, adoption does not look at `target`), and GitHub's CI.

### Verified, and how (this head)

| What | Command | Result |
|---|---|---|
| Build and tests | `pnpm -r build && pnpm -r test` | core 508, CLI 139, web 111, all pass |
| The runner's tests | `node --test scripts/prove-codex.test.mjs` | 8 of 8 |
| Browser tests | `GROOPH_E2E_PORT=4367 pnpm --filter @grooph/web test:e2e` | 295 passed, 164 skipped (the other engines' share). One earlier run timed out six theme tests while the machine's load average was 160; the run before it and the two after it passed whole. Safari's and Firefox's engines run in CI. |
| The Claude Code goldens | `git diff origin/main -- fixtures/golden/claude-code`; `golden:write` | empty; tree clean |
| The game's starting contents | `experiments/game/setup/make-repo.sh --out <scratch>` | `the tree:    3238a9052ce7765c79990029bbff6bccd88628bf` |
| CI's build job, step by step | every `run:` step of the job in order, in one `RUNNER_TEMP`, by a script of mine (the one whose overrun is told above) | every step of the build job passes |
| The proving runner, no model | `node scripts/prove-codex.mjs --dry-run` | instantiates, names Codex, exports; the command it would start is the one `PROVING-COMMAND.md` gives |
| The budget, on this Mac | `node scripts/perf-budget.mjs --check` | first load 160.71 of 164 (main, built here at `7c0a6df`: 160.59); a template's address 279.10 of 280 (main: 279.04). CI's own lines are in the pull request and below once it has run. |

**What the Codex target weighs in the app, on this Mac:** 0.12 KB on the first load and 0.06 KB on a template's address, which leaves 0.90 KB under that limit. Most of it is Codex's profile (`packages/core/targets/codex.profile.json`): every address carries the profiles, because the validator asks whether a harness has one and the harness choice shows its title. The compiler itself is fetched on export and is on no line. No budget line was raised or lowered.

### Still open

- **Criterion 5: the one proving run in Codex.** Not run. The owner starts it in Codex, from the final head, built, as the review's three conditions say.
- **The reasons for refusing** were in this section, the commit `db2e74c` and a comment in `compile/index.ts`. They are in [decision 0030](../../docs/decisions/0030-a-package-is-one-harnesss.md) now, drafted at the driver's word.
- The Codex target's page is not among the site's pages (`scripts/site-pages.mjs` lists Claude Code's only). The rule's row, `docs/rules.md` and `docs/cli.md` are, so three paragraphs a visitor can read change with this merge.

### After the driver's reader, 2026-10-05 (commits `0d608c4`, `b2c1232` and the one after them)

The driver's reader read `0b67de3` and found the three review items closed and nothing in the fix pass wrong (39 shapes of the target field against both targets, the Claude Code packages byte for byte main's across 105 exports). What it found were gaps around item 1's promise. The driver decided each; a lane of Claude Code built them, on top of a third merge of `main` (`862e8cd`).

**A. A machine's model names are per harness.** `GROOPH_MODELS` naming Claude Code's models wrote `model = "sonnet"` into a Codex package's agent files and `-m 'opus'` into its suggested command, and the reverse wrote `gpt-6-luna` into `.claude/agents/`, both exit 0. Now `GROOPH_MODELS` is read for the claude-code target only, as it always was; the codex target reads `GROOPH_MODELS_CODEX` and never `GROOPH_MODELS`; `--models`, typed on the command, applies to that export whichever its target. The export prints which named the tiers; a map that does not parse is reported under its own variable's name; the proving runner deletes both. The test (`packages/cli/test/cli.test.ts`) sets each variable, exports for the other target and reads the other target's own defaults out of the agent file, `MAPPING.md` and `LEAD.md`.

**B. A mixed package.** Exported for Claude Code, named for Codex and exported into the same folder, a graph leaves both harnesses' files beside one `.grooph/<graph-id>/`, exit 0, and the Claude Code skill left behind still says to read `LEAD.md`, which is now the Codex brief. The refusal's own advice led there. The message now ends "and export into a project that does not hold this graph's <first harness> package", and `docs/targets/codex.md` has it under "Known limits".

**The first follow-up, once #60 is on `main`** (it rewrites `export.ts` around a guard for what grooph last wrote): the export notices the other harness's files for this graph id and refuses, or says so. The files to look for, by graph id:

| Exporting for | The other harness's files for this graph |
|---|---|
| `codex` | `.claude/agents/<graph-id>--*.md`, `.claude/skills/<graph-id>/SKILL.md` |
| `claude-code` | `.codex/agents/<graph-id>--*.toml` |

Both targets write `.grooph/<graph-id>/graph.grooph.json`, `LEAD.md`, `MAPPING.md` and `KICKOFF.md`, so those four say nothing about which harness was there; the copy of the graph does, in its `target.harness`.

**C. A critic told apart only by the other harness's pin.** `W_HOMOGENEOUS_CRITICS` read every harness's pin, so the review loop with its critic pinned for Claude Code only, naming Codex, validated clean while the package put both agents on `gpt-6-luna`. It reads the pin for the harness the document names, and a pin for that harness is the model whatever the tier (two nodes pinned to one model are on one model, on one tier or two); a document that names none yet is read by its tier and every pin, as before. A failing fixture (`fixtures/invalid/W_HOMOGENEOUS_CRITICS/pin-for-the-other-harness-only.grooph.json`), a passing one (`fixtures/valid/critic-apart-by-its-harness-pin.grooph.json`), and a test that the package agrees with the warning.

**No shipped document changes its issues.** Every `*.grooph.json` under `patterns/`, `fixtures/`, `community/` and `experiments/` (181) was validated, plainly and for export, under `main`'s build (`4dc0705`) and this one. Three differ, all this pull request's own: the two Codex golden copies of the graph (they name a harness `main` has no profile for) and the new failing fixture. One shipped document has pins at all (`fixtures/valid/pinned-and-skilled.grooph.json`), on a builder with no critic.

**D. Three public sentences.** `README.md` and the technical report's limitations said "Claude Code is the only compile target today. The Codex target is planned" (the report: "One compile target today. A Codex target is planned and not built."). Both now say: "Claude Code is the compile target the built-in templates have been run on. A second target, Codex, compiles and is tested against golden packages; no run of a package in Codex is on record yet." **Three words are mine and not the driver's**: it gave "no run in Codex is on record yet", and my reader pointed out that the repository does record sessions in Codex (the audits, the hook's recordings), so "of a package" says which runs are meant. A fourth sentence of the kind, in `docs/fleets/what-it-would-take.md` ("The second target is not on `main` yet. The Codex target is still in its pull request"), is brought into line too. The diagram in `docs/ARCHITECTURE.md` says `targets/claude-code, targets/codex` where it said "codex later". No other page of the site and nothing on the front page said either. **The FAQ (#54) quotes the README's old sentence**, on a line of its own, and changes when this merges; its pull request says so.

**E. Known limits, stated and not fixed** (`docs/targets/codex.md`): `grooph adopt` takes a harness change a run made (I did not run that case myself: it is as the driver's reader ran it, and from reading, the comparison of brakes does not look at `target`); `grooph validate --for-export` can say "0 errors" for a graph the export then refuses; and the two above.

**F. The decision is on record:** `docs/decisions/0030-a-package-is-one-harnesss.md`, status "proposed with pull request #127". The fixtures' runner validates a document without an export, so it cannot hold "this document, exported for that target, is refused": the rule's row in `docs/graph-ir.md` says the case is held by `packages/core/test/compile-target.test.ts`.

**G. Small.** `MAPPING.md`'s "Parent live sandbox and approval settings can supersede custom settings" is marked as Codex's documentation with no run on record (the two golden `MAPPING.md` move by that sentence; an agent file's "Parent sandbox settings may supersede this agent's settings" is left: it says "may", and it is an instruction's caveat, not a claim of the package). `@grooph/core` exports the Codex profile by path beside the Claude Code one. `scripts/prove-codex.test.mjs` skips its `git check-ignore` case, with the reason, in a copy with no `.git`.

**My own reader on this round** (Opus 5.5, its own clone, the code diff before any account) could not get one harness's tier map into the other's package in 31 probes, and found 144 Claude Code exports identical under `main`'s build and this one. What it found, all in the last commit:

- The export's help, three lines under the new advice, exported the renamed graph for Codex `--into .`, the folder its Claude Code package is in. It names another project now, and says export does not yet notice a mixed package; the design skill's step says the same. `grooph adopt`'s closing line prints `--into <project>` and is left.
- The pin rule kept the tier beside the pin, so a critic and a builder pinned to one model for the named harness on two tiers were not warned about. A pin for the named harness is the model now. What the rule still cannot see is in "Known limits": a pin that names the very model the builder's tier means.
- The rule reference took the new fixture as the rule's one example, because its name sorted first. It is renamed, and the rule's example is the plain case again.
- One assertion of my test of the note could not fail. It reads the variable's name out of the note now, for a graph that prints it, in both targets.
- The validator threw on a harness that is not a string, in a document made in code. It does not.
- The runner's test would have run its git case in a copy unpacked inside another repository.
- **Left as they are:** `PROVING-COMMAND.md` says the workers resolve "without `--models` or `GROOPH_MODELS` overrides", which is still true and is not item 3's to touch (the runner removes both variables); Codex's own handback below names one variable; `docs/PLAN.md` line 175 says "Codex is deferred without a date" against its own line 34, and the plan is the driver's.

**Verified at this head:** core 512, CLI 140, web 111; the runner's tests 8 of 8; browser tests on port 4367, 295 passed and 164 skipped; every generator's `--check`; `git diff origin/main -- fixtures/golden/claude-code` empty; `make-repo.sh` prints the tree `3238a9052ce7765c79990029bbff6bccd88628bf`. **The budget on this Mac:** first load 160.75 of 164, a template's address 279.14 of 280 (`main` here: 160.59 and 279.04). The pin rule is in the validator, which every address loads: it costs about 0.04 KB. On CI the last head read 160.97 and 279.52 against `main`'s 160.85 and 279.45; this head's lines are in a comment on the pull request.

### The stack's budget, and the profiles out of the first load (commit `3a3d24a`)

The driver had me merge the heads of seven open pull requests onto `main` in a scratch copy and run the budget: a template's own address read 279.57 of 280 on this Mac, about 279.98 by CI's figure. It ruled three things.

1. **Done here:** every address carries a compile target's id and title (`packages/core/src/targets/names.ts`), and the profiles come with the compiler (`targets/index.ts`). `packages/core/test/targets.test.ts` holds the names to the profile files, holds `base.ts` to reaching no profile, and exports for each target at every tier and effort to see its whole profile; the browser test of the harness choice reads both titles. On this Mac, after a fourth merge of `main` (`ac97b14`): the first load 160.56 of 164 (`main`: 160.79), a template's own address 279.14 of 280 (`main`: 279.39). So this pull request now takes about a quarter of a kilobyte off `main`'s lines where it added an eighth.
2. **Next, its own pull request:** the one-file page's builder (`packages/core/src/offline.ts`, about 2.6 KB of the shared chunk by its source map) behind an on-demand piece, fetched when a person presses "Keep a copy".
3. **For after the pause, one line:** reading a run (`packages/core/src/runs.ts`, about 4.1 KB of the shared chunk by its source map) is carried by every address and needed by a run's page only.

**#60 and this pull request do not merge cleanly** (`packages/cli/src/commands/export.ts`, `help.ts`, `docs/cli.md`, `apps/web/test/export.test.ts`). This one goes first; what must survive the other's merge is in this pull request's description.

### Prompt to paste into the driver session

```text
The second fix pass of slice 0076 is on branch slice/0076-codex-target-second-pass: the code's head is the commit before this section's (after the driver's reader's findings A to G and my own reader's on them), and the handback's new section (handoffs/0076-codex-target/HANDBACK.md, "Second fix pass, 2026-10-05") follows it in documentation-only commits. It carries Codex's commits unchanged and supersedes pull request #70. Status: done for the review's second read; criterion 5, the one proving run in Codex, is still the owner's to start. Please have your reader look at item 1 and reconcile with the grooph-reconcile skill.
```

---

## Codex's handback of 2026-10-04, as written

**Implementer:** GPT-6.1 Sol with three GPT-6 Luna workers · **Branch:** `slice/0076-codex-target` · **Head commit:** `be9f55b41312fb03504761e64aabe713a53e11c0` (pushed implementation; this handback follows in a documentation-only commit) · **Date:** 2026-10-04

## Status

`blocked` — The five review fixes are complete; original handoff criterion 5 remains intentionally deferred because the owner explicitly required no model session in this pass, with fresh driver review before proving.

Draft PR [#70](https://github.com/ryanjosephkamp/grooph/pull/70) remains draft and unmerged. No external Codex model session or native transcript access occurred. The exact next invocation and its external footprint are in [PROVING-COMMAND.md](PROVING-COMMAND.md).

## What changed

- **Core / profile:** `compile/index.ts` checks the graph schema before semantic validation for either target. The Codex TOML writer escapes DEL and replaces unpaired UTF-16 surrogates with U+FFFD while preserving valid pairs. It emits no approval key. The profile maps `frontier` to Sol and `strong`/`fast` to Luna; the suggested startup command uses the lead's resolved model, quotes its kickoff path, and sets the worker default for that invocation. `MAPPING.md` computes collapse wording and states that CLI help was read, with no package run claimed.
- **Tests:** new `codex-mapping.test.ts`, `codex-toml.test.ts`, `compile-schema.test.ts` and CLI `codex-tiers.test.ts`. Existing approval assertions now require absence. Existing Claude writer tests retain their internal defensive quoting coverage while expecting public `compile()` to reject invalid documents. ID coverage includes graph, nodes, edges, loops, policies and groups for both targets.
- **Generated packages:** regenerated only the two Codex packages through the built CLI. Changed files are their three agent TOMLs and two `MAPPING.md` files. Codex `LEAD.md`, `KICKOFF.md` and canonical graph files retain their reviewed bytes. Changes concern approvals, model mapping/startup and help-inspection provenance; kickoff-path quoting is in the startup command already changed for those requirements.
- **CLI / main sync:** reused main's slice 0084 tier-note helper for Codex, including target defaults, overrides and exclusions for unused or pinned tiers. No separate Codex note algorithm remains. Main's default-tier, irreversible-path and group/schema changes were imported through merge commits, not reimplemented by this lane.
- **Mapping / proving preparation:** updated `docs/targets/codex.md`, the proving preparation page and runner. The runner inherits approvals, exports the committed profile defaults without `GROOPH_MODELS`, and passes its temporary `GROOPH_HOME` to the child process. New `PROVING-COMMAND.md` records the proposed one-run command and native-home/transcript boundary.

## Verified, and how

### The five numbered review items

The baseline was the reviewed `1f6fdbb` implementation merged with main at `e8e1971` (merge `eae6813`). The new tests were exercised against the old behavior before fixes. The subsequent main sync was pinned to `5e97cc0` (merge `ff23613`); it includes the driver's later default-tier and document/schema changes.

| Review item | Observed old behavior / regression | Fixed evidence |
|---|---|---|
| 1. Inherit approvals | Existing Codex settings assertions changed to require no key failed twice; the runner command test failed on its approval override. The new mapping approval/refusal test failed too. | Agent files and suggested/actual lead argv contain no approval override. Mapping/docs explain owner policy, unattended refusal and instruction-based gates. Codex contract/mapping tests and all six runner tests pass. |
| 2. Sol leads, Luna works | The five mapping tests failed on the old profile/wording/startup behavior. The new CLI default-collapse test failed because no note was printed without an override. | Mapping tests cover defaults, changed tier pairs, distinct overrides, lead resolution and omitted node models. CLI tests cover stock Luna collapse, overrides and unused/pinned tiers. All pass. |
| 3. Valid TOML | Three schema- and validator-accepted probes failed Python `tomllib`: DEL was an illegal literal character; lone high/low surrogate escapes were not Unicode scalars. | Real Python `tomllib` parses every emitted agent file over eight fields × eight control/Unicode cases, with literal decoded-value expectations, plus overrides. Restricted skills/pins have explicit schema-rejection and accepted-name coverage. All pass. |
| 4. IDs and quoted path | Both target schema regression tests failed with “Missing expected exception.” Mapping path quoting also failed. | Public `compile()` and `tryCompile()` reject malformed/missing/non-string IDs with `E_SCHEMA` for both targets. Valid output goldens still pass, and the Codex startup path is shell-quoted. |
| 5. What was done | The new help-inspection wording test failed against “profile verified against CLI.” | Generated mapping says CLI `0.160.0` help was read and the package has not been run in Codex; the regression passes. |

The combined baseline schema/mapping run had nine tests: two passed, seven failed (both schema rejection tests and all five mapping tests). The independent Luna integration review of the final fixes found no actionable missed requirement; it is code review, not the driver's fresh acceptance review or native proving evidence.

### Original handoff criteria

| Criterion | Evidence |
|---|---|
| 1. Mapping | `docs/targets/codex.md` marks every unit documented, seen or unknown with primary sources. “Seen” covers the original CLI help/version inspection and cited prior repository observations; runtime loading, dispatch, isolation, skills, live reload and gate/resume remain unknown. |
| 2. Core/compiler | `pnpm -r build` and `pnpm --workspace-concurrency=1 -r test` pass on the synced tree: core 397, CLI 123, web 66. Package-level execution was serialized to reduce local timing contention. |
| 3. Goldens | Core golden tests pass for both fixtures and both targets. Claude compiler source and goldens match synced main `5e97cc0` byte for byte. Neither fix commit edits them. Main's 0084 golden/model changes arrived only in its separate sync merge. Codex changes are limited to the five files described above. |
| 4. CLI/app | CLI and web unit tests pass. `GROOPH_E2E_PORT=4363 pnpm --filter @grooph/web test:e2e --workers=2`: 210 passed, 125 configured skips. `GROOPH_BROWSERS=1 GROOPH_E2E_PORT=4363 pnpm --filter @grooph/web test:e2e --project=safari --project=firefox --workers=1`: 44 passed. Both Linux browser CI jobs pass. These are desktop browser tests, not physical-device evidence. |
| 5. Proving | **Unmet by direction.** Runner tests 6/6 and `--dry-run` pass. The fixed defaults export two Luna agent files; preview argv names Sol/high and no approval override. No native session id, usage, USD result, run id, gate ending or transcript receipt exists. No `run/` proving record was created. |
| 6. Checks | Generated pattern, field-guide, rule, CLI, community, site, version and picture checks, brake-value check and American-English check pass after sync (593 public-facing files). All 76 script/runner tests, outside-address check, first-run quickstart and local-install harness pass. All CLI CI recipes pass after sync: four export/diff comparisons, new/apply, validator fixtures, built-in template export, shape/share/pick. All eight push/PR CI jobs pass on implementation `be9f55b`: Node 22/24 build/tests/checks, Chromium and Safari/Firefox. |

Final performance check passed: first load 179.14/180 KB gzip, scripts 157.72/162, styles 19.91/20, front-page fonts 40.69/42, total front-page visit 221.15/224, canvas 277.04/280, embed 127.05/132, CLI startup 109.97/400 ms. The compiler is loaded later at 29.16 KB gzip. Local runtime is Node 26.10.0 and pnpm 11.7.0; Linux Node 22/24 are covered by PR CI.

Before the final rerun, a concurrent local batch exceeded the CLI cold-start budget, one existing hook-race timing assertion (19.7 seconds against 15), and Firefox cache/smoke timeouts with invalid-content-encoding/framebuffer errors. No unrelated test, hook, browser configuration or budget was weakened. Serial unit execution, an idle performance check and lower-concurrency browser reruns subsequently passed. CI's configured concurrency also passes.

## Decisions made

1. **Model defaults:** chose the requested profile map: frontier Sol, strong and fast Luna. No-model worker TOML still omits `model`, preserving the graph's inheritance contract; the suggested kickoff supplies invocation-scoped `agents.default_subagent_model` from `defaultTier`. An explicit lead with no model keeps the native session default. A graph without a lead node starts with the profile's frontier model. Pins and explicit node tiers still win.
2. **Approvals and stops:** removed approval settings entirely rather than selecting another policy. Owner settings apply. A refused command is a failure returned to the model; the brief instructs it to report and stop when necessary. Graph gates and stops remain lead duties, without a native-halt claim.
3. **String handling:** used an ES2022-compatible surrogate walk instead of requiring a newer runtime string API. TOML requires scalar Unicode and an escaped DEL; tests check actual parsing and literal decoded output, not an implementation-shaped serializer mirror.
4. **Schema boundary:** centralized full schema validation in public `compile()`, before path construction for either exporter. Existing private writer defenses remain unchanged and tested; valid package bytes remain the golden contract.
5. **Custody / sync:** edited, built, committed and pushed only from `/Users/noir/Documents/grooph-codex`. The app worktree and driver checkout were untouched. Initial merge `eae6813` brought in main `e8e1971`; separate merge `ff23613` synchronized main `5e97cc0`. Its export conflict was resolved to the driver's shared helper. No history was rewritten.
6. **Proving permission:** the proposed command uses ordinary installed Codex authentication/configuration and normal native session state. It changes no saved approval, trust or hook setting. Its runner never opens native transcripts; only the later, separately authorized invocation-specific path/checksum receipt would do that. External reads/writes are listed in the command artifact.

## Deviations

- Original criterion 5 remains deferred exactly as the owner directed for this pass. The fix pass is not native proving and does not turn unknown runtime behavior into seen evidence.
- The sync merge imports the driver's changed Claude profile/goldens from 0084. The lane's fixes preserve those synced bytes, and the final PR has no Claude compiler/golden difference from that main baseline.
- No spec amendment, dependency change, direct edit of `docs/PROGRESS.md` or `docs/PLAN.md`, model proving invocation, native transcript read, or merge of PR #70 occurred.

## Risks and leftovers

A fresh driver reviewer must re-run review items 1–5 on the pushed head. Then the owner may approve or decline the one proving invocation and its native transcript receipt described in [PROVING-COMMAND.md](PROVING-COMMAND.md). Keep PR #70 draft until the actual proving outcome is recorded; failure is a result to retain. Publishing the target/app choice remains the owner's merge decision.

Custom-agent loading/dispatch, fresh-history exclusion in CLI, skill loading, effective native settings, live agent edits and reliable gate halt/resume remain unobserved. A normal model request spends usage; USD is unknown, not zero. The checker verifies retained evidence consistency and cannot prove every scope, ownership, context or adaptive-brake property.

Compared with Claude Code output, Codex has no emitted native tool allowlist/disallowed-tools list or skill preload, and no documented CLI dollar-cap flag. It does document per-custom-agent sandbox configuration and independent reasoning effort, and a JSONL exec stream with session id/usage. These are mechanism descriptions, not quality, cost, speed or safety claims.

The review's lower-priority overwrite and cross-graph name-collision cases remain outside this fix pass. A second template, `fix-until-green`, is compiled and golden-checked; native proof would need its own task mode, fresh destination and owner authorization, with check-node/back-edge/final-stop evidence. The first review-gate run would not prove gate resume without a later explicit human answer.

## Prompt to paste into the driver session

```text
The 0076 fix-pass handback is at handoffs/0076-codex-target/HANDBACK.md on slice/0076-codex-target (implementation be9f55b41312fb03504761e64aabe713a53e11c0, followed by its handback commit), draft PR #70. Main is synced through 5e97cc0. All five numbered review fixes have regression tests. Please use grooph-reconcile, then have a fresh reviewer re-run items 1–5 on the pushed head. Native proving was explicitly not invoked in this pass. Keep the PR draft and do not merge. The proposed exact review-gate command, external state access and separate transcript receipt are in handoffs/0076-codex-target/PROVING-COMMAND.md; the owner must decide before that run starts.
```

# Handoff 0110 · A larger pilot of the old line, in Codex, on paper

**Stage:** 25, on the lab's side · **Lane:** Opus 5.5 · **Effort:** extra high (high is the floor: an experiment designed carelessly is found out only after it has been paid for) · **Browser tests on port:** 4372 for the held-out checks' own server, and never 4361 · **Branch:** `slice/0110-a-pilot-on-paper` · **Drafted:** 2026-10-11 · **Confirmed by owner:** 2026-10-11, on the review desk: three arms, yes (card q88). **The game is a mech arena** (card q93, 2026-10-11: "Approved. Mech arena it is."). He had turned down mini golf, tower defense and a kart time trial (card q88: "I don't really like those game ideas. Please come up with different ones."; in the chat: "Let's find something exciting! Action-packed?"), and chose it from five offered on card q93

## Objective

The owner changed grooph's direction on the evidence of seven small tasks, and says so himself: "I'm still not fully convinced that our earlier grooph hooks / agent coordination / etc. approach … is inferior to standard prompts." Nothing longer or larger than those tasks was ever tried. He wants to try: a medium-sized browser game, built in Codex with Blender and three.js, once from a prompt and once from a grooph package, "designed carefully so as to perhaps reveal problems with grooph if any exist, i.e., we would choose a game for which a loop graph coordination workflow seems most likely to be helpful."

This slice is that pilot **before it is run**, so that he can read it and say yes: the game's spec, the loop graph, the checks no builder sees with the proof that they can pass and can fail, the three arms, a protocol that says beforehand what the result can and cannot say and what would count against the graph, and a runbook for Codex with each step a line to paste. `experiments/game/` is the model for all of it; this is a different game, and unlike that experiment it has arms without grooph.

**Nothing is run.** No model session, no repository made on GitHub, no asset downloaded. Directing a session is the lab's side of grooph since decision 0032, and `AGENTS.md` says that side is not to be extended: this pilot is the exception the owner asked for on 2026-10-11, it adds nothing under `packages/` or `scripts/`, and it says nothing about the product.

## Success criteria

1. **`experiments/pilot/SPEC.md`**: the game, for whoever builds it. What is fixed, milestones with times, what to drop when time is short, and a test surface a script can drive. Every asset is made in the repository by a Blender script run headless (`/Applications/Blender.app/Contents/MacOS/Blender --background --python …`) and exported as glTF, with budgets a check can read (triangles, bytes, named nodes); nothing is downloaded. The simulation is deterministic, so that a scripted player's result is the same twice.
2. **It is chosen to give a loop graph its best case**, and the spec says why in a paragraph: many units of the same shape that can be built side by side against one contract; an integration that fails if the contract drifts; a bar a critic can run and not merely judge; and a first pass that should fail that bar. For the game he chose, a mech arena, as card q93 put it to him: the player pilots a mech bolted together from parts (legs, core, arms, weapons) against enemy mechs; each part is a module with sockets; the bar is that every combination of parts assembles, walks and fires, which a script sweeps, and that a scripted pilot wins the test fight. (This handoff adds, as it did for the mini golf's tee and cup: the sockets are named in each part's glTF, so that a check can read them.) The parts are built apart and meet only at assembly, and the sweep finds the combinations nobody tried by hand. It is the closest of the five to the arena shooter of `experiments/game/`: that experiment is the model for the documents and nothing of its spec, its graph or its checks is reused, and the spec says in a line how the two games differ.
3. **The checks no builder sees**, with their stand-in, kept outside this repository, which is public: a git repository of their own with no remote at `/Users/noir/Documents/grooph-exchange/pilot/held-out/`. In this repository: `experiments/pilot/acceptance/README.md` with what each check asks in a line, the checksums of the held-out files, and the proof: every check passes against the stand-in, every check fails with its behavior off, and each behavior is caught alone, with the counts printed by a command the README names.
4. **Three arms, one task**, in `experiments/pilot/PROTOCOL.md`: the task alone, with leave to use subagents and not a word about how; the same design as prose, derived by the rule of [`docs/comparisons.md`](../../docs/comparisons.md) §3 and never written by hand; and the package: a graph document of the pilot's own (begun from `gauntlet-decomposed` with `grooph template use`, or drawn fresh), naming `codex` as its harness, valid for export with no error, exported with `--target codex`. The rule's script (`scripts/lib/compare-prompt.mjs`) reads a Claude Code package's layout, and a Codex package keeps its agents as TOML: derive the prose from the same graph's Claude Code package, through a wrapper of your own under `experiments/pilot/setup/` if one is needed, and list in the protocol every word in the result that was one harness's and what the rule put for it. Same models in every arm (GPT-6.1 Sol leads and judges, GPT-6 Luna builds; never Astra), same time, same starting contents but for the arm's own files, web search off.
5. **The protocol says, before any run:** what the result can say (three accounts of what happened once) and cannot (that a graph beats a prompt: say how many runs of each arm that would take, as `experiments/game/PROTOCOL.md` §6 does); **what would count against the graph**, named now (a lead that does not start the agents the graph names; a loop that never turns, or turns without its critic playing the game; a stop that came due and did not fire; a builder that read the held-out checks; a session still building at the wall; a result that does not build or start); how each build is scored (the held-out checks three times, and the owner's ten minutes on builds labeled A, B and C by someone who is not him); and how the story of each run is read afterward from Codex's own record, with nothing of grooph's installed in any arm.
6. **A proposal for the time each arm gets**, with the reasoning, and what it would cost him in hours at the keyboard. He decides.
7. **`experiments/pilot/RUNBOOK.md`**, for the owner: first one small proving run of a Codex package (`scripts/prove-codex.mjs`, minutes: no Codex package has ever been run, and the pilot must not be the first); then, per arm, the starting contents built outside this clone by a script (`experiments/pilot/setup/`), the three private repositories he makes, the line that starts Codex, what he should then see, and what to do if it is not as written.
8. **A page for the owner**, `handoffs/briefs/pilot.html`, phone first: the game in a paragraph with a picture of the graph, the three arms, what it can and cannot say, what it costs him, and the questions that are his, each with a recommendation.

## Read first

1. `handoffs/0110-a-pilot-on-paper/HANDOFF.md` (this file)
2. `experiments/game/` whole: README, SPEC, PROTOCOL, RUNBOOK, FROZEN, `acceptance/`, `setup/`. It is the model, and its handoffs (`handoffs/0082-game-experiment-design/`, `handoffs/0089-the-claude-code-arm-made-ready/`) say what went wrong making it.
3. `docs/comparisons.md`, and `docs/faq.md` for what the two studies showed in the words the audit left standing
4. `docs/targets/codex.md` (what is documented, seen and unknown about a Codex package) and `docs/subagents.md` §3 (Codex starts subagents only on a direct request or an instruction)
5. `patterns/gauntlet-decomposed.grooph.json`, `docs/graph-ir.md`
6. `docs/decisions/0032-grooph-draws-and-watches.md`, `AGENTS.md`, `handoffs/README.md`

## Allowed changes

`experiments/pilot/**`; `handoffs/briefs/pilot.html` and a folder of pictures beside it, each 150 KB or less; `handoffs/0110-a-pilot-on-paper/**`; and, outside the repository, `/Users/noir/Documents/grooph-exchange/pilot/**`.

## Forbidden changes

- **Starting a model session of any harness**, making a repository on GitHub or giving one a remote (the held-out folder is a local git repository and no more), pushing anything outside this repository, downloading an asset or a tool. You may run Blender headless and a browser, on this Mac, to prove the stand-in and the checks.
- **`~/.codex` is not read**: it holds the owner's other projects' sessions. What Codex keeps of a session is taken from this repository's own records (`docs/subagents.md`, `handoffs/0027-live-subagents/experiments/`, `experiments/hooks/`) and marked documented, seen or unknown.
- `packages/**`, `apps/**`, `scripts/**` (call the runners and the command as they are, through one variable for the command's path: slice 0103 is renaming it to `grooph-lab` while you work), `experiments/game/**`, every other experiment's records, `patterns/**`.
- A sentence about what grooph does to the quality, cost, speed or safety of work, anywhere (decision 0024).
- The held-out checks or the stand-in in this repository, in a pull request's text, or in anything an arm's session will be given.
- `docs/PROGRESS.md`, `docs/PLAN.md`, `handoffs/DRIVER.md`. A pushed branch rewritten. A merge.

## Spec constraints that apply here

- Decision 0015: a run is recorded before its result is used. The runbook makes each session's record folder and ledger row before the session starts.
- Decision 0031: the models named are the owner's policy for this project's own runs.
- Decision 0032, point 8: what is said of the old line is what the questions page says, and no more.
- `docs/graph-ir.md`: the graph validates for export with no error.

## Design already decided

- **Three arms.** Without the prose arm a better result from the package cannot be told from simply having a design, which is what both studies found mattered.
- **The open arm says subagents may be used.** By its documentation Codex does not start one unasked, so an arm silent about them would show nothing of what Codex chooses.
- **Nothing of grooph's is installed in any arm's repository**: no hook, no server. What happened is read afterward from the harness's own record.
- **Blender by script, headless, in every arm.** No Blender add-on, no MCP server for it.
- **Held-out means out of the public repository**, and web search off in every arm.

## Implementer's choices

Within the mech arena: which parts and how many of each, the sockets' contract, the enemies and the test fight; the graph; the milestones and their times; the checks; how the starting contents are built; the page.

## How to verify

```bash
GROOPH="node packages/cli/bin/grooph.js"        # after slice 0103's second pull request: node lab/bin/grooph-lab.js
$GROOPH validate --for-export experiments/pilot/<the graph>
$GROOPH export experiments/pilot/<the graph> --target codex --into "$TMPDIR/pilot-package" --models <as the protocol names>
<the command the acceptance README names>     # every check passes on the stand-in, fails with its behavior off, each caught alone
node scripts/american-english.mjs --check
```

## Handback must contain

The `TEMPLATE-HANDBACK.md` sections, plus: the proof's counts; the checksums of the held-out files; what in the protocol rests on Codex documentation, on something seen, and on nothing yet; the owner's questions with a recommendation each; and what you would change in `experiments/game/` having made this.

## Prompt to paste

```text
You are a lane of grooph: slice 0110, a larger pilot of the old line in Codex, on paper. Read handoffs/0110-a-pilot-on-paper/HANDOFF.md first, then experiments/game/ whole, then AGENTS.md and the files the handoff names. Work in your own worktree on branch slice/0110-a-pilot-on-paper, a draft pull request at the first push. Nothing is run: no model session, no repository on GitHub, no download. The checks no builder sees and their stand-in go outside the repository, in /Users/noir/Documents/grooph-exchange/pilot/, never in a pull request. Do not read ~/.codex. Serve the checks on port 4372 only, never 4361. Do not edit docs/PROGRESS.md, docs/PLAN.md or handoffs/DRIVER.md, and merge nothing. When it is ready, send the driver the head with SendMessage and push nothing more to it. Finish with the grooph-handback skill.
```

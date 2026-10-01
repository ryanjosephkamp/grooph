# The operator round: the owner's brief, 2026-09-30

The prompt the owner pasted into a fresh Opus 5.5 session on 2026-09-30 to restart grooph after a week's pause. It is the handoff for slices 0024 to 0028 ([decision 0014](../../docs/decisions/0014-the-operator-round.md)). The owner keeps a copy as a page on his other Claude account (`https://claude.ai/artifact/8cvqc9QWNx3RdAPTCad3P4`); this account cannot read that page, so this file is the record. Kept verbatim.

One correction, found while reading the repository: the brief cites amendment A-010 for "the lead is the main session, and every other agent node is a subagent". That contract is `docs/graph-ir.md` §1 and §2 with `docs/targets/claude-code.md`; A-010 is the prior-art sources and positioning amendment.

```text
You're picking up grooph (github.com/ryanjosephkamp/grooph) for its owner, Ryan, after a pause of about a week. You run in Claude Code on his Mac, on Opus 5.5 at high effort. He often drives you from his phone with Remote Control, so keep your messages short and plain, and give step-by-step instructions whenever he has to do something.

Read first: AGENTS.md, CLAUDE.md, docs/PROGRESS.md, docs/PLAN.md, docs/HANDOVER.md, spec/capability-spec.md, spec/AMENDMENTS.md, docs/graph-ir.md, docs/runs.md, docs/targets/claude-code.md and docs/decisions/0013-value-as-of-study-one.md. The repo's own rules and skills (grooph-status, grooph-handoff, grooph-handback, grooph-reconcile) still apply.

WHY NOW
- Study one (27 runs, Opus 5 lead, Fable 5.1 judge) found the same held-out scores for the graph package, the same design as prose, and prose in a loop. The graph earned its keep as a brake and as a record, not as better output (decision 0013). Ryan ran out of usage mid-way through the next steps, so some work on this Mac may be uncommitted.
- Ryan now runs a much bigger operation, and he wants grooph to show it:
  - a long-lived "Operator" Claude Code session in the cloud, on his other Claude account, that starts and steers about a dozen cloud worker sessions (lanes) for a project called Splashery, plus test-runner sessions and scheduled routines;
  - a private research project with its own cloud lanes;
  - Codex on this Mac (GPT-6.1 Sol and other OpenAI models);
  - this account and this Mac.
  The GitHub repos are the only links between these, plus Ryan himself carrying prompts from one to another.
- He likes the web app as it is. Polish it; don't redesign it.

STEP 0: SAVE THE OLD WORK, THEN START FRESH
Take an inventory: `git status`, untracked files, stashes, other branches, results folders. Commit everything worth keeping to a branch named `archive/study-one-wip`. Check it for secrets and very large files first; keep big raw results out of git and note where they are. Push that branch. Add one paragraph to docs/PROGRESS.md saying what was in progress, then go back to main. Don't resume the old runs.

THE FIRST ROUND (build these, in whatever order you judge best)
1. A fresh-eyes review. Run the app, the tests and the CLI, then write docs/review-2026-10.md: what works, what's broken, and what feels rough on a phone (390 px wide) and on a computer. Rank the fixes and do the clear ones. The repo's handbacks already list some: untested pinch and drag, about four taps per edge on a phone, wide graphs opening at about a third of full size, the small run-view canvas, three undo bugs, and a share link with a malformed % that throws. Make the README honest: it promises an outline view and an MCP server that don't exist yet. Build them or say so.
2. Image exports. PNG and SVG of the whole graph, readable at phone size, in light and dark. A single offline HTML file that holds the graph and a viewer, so Ryan can open it with no internet. The installable offline app (stage 8) is a good follow-on if it's cheap.
3. Maps that span harnesses. Today a graph is one session and its subagents: the lead is the main session, and every other agent node is a subagent (amendment A-010). Keep that contract intact. Add a separate kind of document, an "operation map", that shows but doesn't compile:
   - nodes are sessions, each with its harness (Claude Code, Codex, cloud or local), account, machine, model and role;
   - a node may point to its own loop graph (nested graphs are deferred today);
   - edges are handoffs, and each names its carrier: a repo branch or PR, a scheduled message, a review page, or a person carrying a prompt;
   - lanes group nodes by machine and account.
   Propose the schema as an amendment first, version it so old graphs keep loading, and add validator rules that fit, such as a handoff with no named carrier. Draw a sample: "Ryan's operation, September 30, 2026", from the list in WHY NOW (ask Ryan for anything you need; keep it generic where a detail isn't needed).
4. A live view of subagents. This is slices 0021 (hook-written notes) and 0023 (the live run view), widened to Codex:
   - Claude Code has SubagentStart and SubagentStop hooks, and tool events inside a subagent carry its agent id;
   - Codex has subagents (`agents.enabled` and related keys) and SubagentStart and SubagentStop hooks as well, set in hooks.json or config.toml;
   - a hook that only appends one JSON line to the run's events file, and never blocks, can't change what the agents do;
   - `grooph watch` turns that file into a graph that updates as agents start and finish, and it can merge several sessions' files;
   - where the docs are silent (what each Codex hook receives; where Claude Code keeps subagent transcripts, which scripts/lib/prove-evidence.mjs already reads), find out with small, cheap experiments and label what is documented and what is observed.
   Write docs/subagents.md: how subagents work in each harness, how they're coordinated, what a hook sees, and citations to the official docs. Ryan wants to understand this himself, so write it for a smart non-specialist.
5. An MCP server, if it fits naturally after 4: tools such as "declare my planned subagents", "write a note" and "what's running", so a lead can show its plan beside what actually happened. Whether this makes a lead coordinate better is an open question, so treat any test of it as a small experiment.

LATER, ONLY WHEN RYAN SAYS GO
- A Codex compile target (stage 9).
- Study two (slice 0019) with Opus 5.5 and Sonnet 5.5 in place of Opus 5 and Fable 5.1. Ryan is especially curious what Sonnet 5.5 can do as a worker. Anything that starts many sessions waits for his go.

HOW TO WORK
- Ryan doesn't want your work limited by usage worries. He tracks usage himself and will tell you if it matters. Don't take shortcuts that lower quality.
- Work on branches, open pull requests against main and keep them small. Never rewrite pushed history, and never commit secrets. Keep docs/PROGRESS.md current.
- Change the product contract only through a written amendment; don't quietly drift from the spec.
- Report honestly: what you verified, what you didn't, and what you assumed.
- End each working turn with a short status: what changed (with links), what's next, and any question for Ryan.

THE HANDBACK
When exports, the operation map and the live view work, write docs/HANDBACK-operator.md for the Operator on Ryan's other account:
- the version or tag;
- how to install and run it (commands);
- the operation-map format, with the sample;
- how to run the live view for Claude Code and for Codex;
- known limits.
Then tell Ryan it's ready. He'll pass it to the Operator, which will build a live map of the whole operation from it.
```

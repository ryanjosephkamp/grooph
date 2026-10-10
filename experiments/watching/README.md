# The watching check

Does watching a session change what it does?

The owner asked for one kind of test before grooph is changed from something that directs agents into something that watches and draws them (decision 0032): that what grooph adds does not get in the way of how a session would work anyway. This page is that test, written before anything is run. It uses what grooph 0.4.1 already ships and builds nothing new into the product.

**Status: written, not run.** The free checks at the end have been run and need no model. No model session has been started.

## What is asked

1. **Does installing the recorder change what a session does?** The recorder is the event hook `grooph hooks install` puts in a project. It prints nothing and always exits 0, so a session is handed nothing to read. What it does leave is files in the project: `.claude/settings.json` and `.grooph/`.
2. **What does an invitation cost, and does it change what the model chooses?** The invitation is one sentence, two tools with which a session may say what it intends, and what grooph's MCP server itself tells a session, as 0.4.1 ships it.
3. **Is the record true?** Does what the hook wrote agree with what the harness's own transcripts say happened?
4. A by-product: the first recordings of what a model does with subagents when it is allowed to use them and told nothing about how.

## Three ways of running one task

| Arm | What is different |
|---|---|
| **Plain** | Nothing of grooph is in the project, in the session's settings or on its path. |
| **Watched** | `grooph hooks install` was run in the project before its one commit, with no other flag. The prompt is the plain arm's, to the letter. |
| **Watched and invited** | As watched, and: grooph's MCP server is attached with two of its tools offered, `grooph_plan` and `grooph_note`, and every other tool of it withheld; and the prompt ends with the invitation below. |

The prompt in every arm is the task, then this sentence:

> You may use subagents for any part of this if you judge that it helps. You do not have to.

The invitation, in the third arm only, after that sentence:

> If you do use subagents, you may say what you intend with the `grooph_plan` tool, and leave a short note for whoever is watching with `grooph_note`. This is optional, and nothing here depends on it.

**What the third arm really holds.** grooph 0.4.1's MCP server gives every session that attaches it some 400 words of instructions of its own, written for all of its tools. One sentence of them is about these two: "In a coding session: before starting subagents, call grooph_plan with the kinds you will start". The description of `grooph_plan` says "Call it again when the plan changes", and its reply says "Start them as you planned". Those are instructions, not an offer, and the new contract will not allow them (decision 0032). They are left in on purpose: this check is of what exists. So a difference in the third arm cannot be divided between the one invited sentence and the server's own words, and what the arm measures is the said layer as 0.4.1 ships it.

Nothing else differs. Every session is headless (`claude -p`), on Claude Sonnet 5.5 at high effort, started from the clean profile of [`experiments/comparisons/profile/`](../comparisons/profile/README.md) by that profile's own runner, so that it loads nothing of the owner's account and can write nowhere but its own folder. Which model a subagent runs on is left to the session: it is one of the things watched. The profile pins what each short name means (`opus` and `fable` to Opus 5.5, `sonnet` to Sonnet 5.5, `haiku` to `claude-haiku-4-5-20251001`), so the name a session asked for and the model that answered are both kept.

## Two tasks

Both are made of tasks this repository already holds, unchanged, each with a suite of tests no session is shown.

- **`one`**, a narrow task: `printkit`, the task of [`comparisons/heterogeneous-critic`](../comparisons/heterogeneous-critic/), worded as that project's task-alone prompt words it.
- **`four`**, a wide task: one repository holding four packages side by side, each a task as its own project keeps it: `settingskit` ([`review-gate-2`](../comparisons/review-gate-2/)), `textwrap` ([`spec-then-loop`](../comparisons/spec-then-loop/)), `csvline` ([`red-team-loop`](../comparisons/red-team-loop/)) and `semver-mini` ([`grind-loop`](../comparisons/grind-loop/)). The prompt gives the four tasks one after another, each worded by the comparison protocol's rule for a task alone ([`docs/comparisons.md`](../../docs/comparisons.md) §1), with its folder named. The four have nothing to do with each other, so handing them to subagents is an open choice and never a need.

Two tasks, three arms, twice each: twelve runs, one at a time, in this order: `one` plain, `four` plain, `one` watched, `four` watched, `one` invited, `four` invited; then the same six again.

## What is measured, and from where

Every arm is measured the same way, **from the harness's own files in the clean profile, never from grooph**: the session's transcript, and the file the harness keeps beside each subagent's transcript.

- Subagents: how many, of which types, on which models, how deep, started in the foreground or the background.
- The session: turns, tool calls by tool name, minutes, tokens, and the cost the harness reports.
- The result: how many of the unseen tests pass, for each package.
- The footprint: how many of the session's tool calls name `.grooph` or `.claude/settings.json`, or get a result that shows either (`git status` lists the hook's own file as untracked while a watched session runs). Counts; what a call said or returned is not kept.
- In the watched arms, the hook's own file is kept, and set beside the transcripts: a subagent the harness started with no start line, a start with no stop, a line for a subagent that was never started.
- In the invited arm: whether either tool was called, how many times, and what was said. That text is kept. It is the session's own statement and it is what the arm is for.

## How it will be read

All twelve rows are published in one table, with every run's record.

- For any measure, **"no difference seen"** is said of two arms only when their values overlap on both tasks. Nowhere is "no effect" said. Twelve runs can show a large effect and cannot show a small one.
- A difference is reported as seen, with both runs' values.
- Agreement between the hook and the transcripts is given as counts.
- What the invitation costs is the invited arm's turns, tokens and cost beside the watched arm's, as ranges.

What it cannot say: anything about another model, another harness, a session a person is typing into, a run of hours, an agent team, or whether the new direction is worth building.

## Limits

- A run of `one` stops at $2.00 or 15 minutes. A run of `four` stops at $6.00 or 40 minutes. These are the runner's watchdog; no session is told of them.
- The whole check stops at **$45.00** on a ledger of its own, `ledger.json` in this folder, which is made with the runner. A cost that is not yet settled counts at its ceiling. The twelve ceilings add up to $48.00, more than the cap, on purpose: a run is not started unless the ledger has room for its ceiling, so the check ends early if the runs cost far more than expected. The dollars are the list price the harness reports; on the owner's subscription they are usage and not a charge.
- A run that fails for a reason outside the session (the sign-in, the network, a usage limit) may be run once more, with the reason written beside it.
- A run is recorded before its result is used (decision 0015): the harness's output saved as it runs, a ledger row with the session's id and reported cost.

## What has to hold before the first run

1. This page is on `main`. After the first run nothing here changes without a dated note saying what and why.
2. `node scripts/lib/compare-profile.mjs --check` holds on every line. (It did on 2026-10-09: the profile is signed in, and nothing has ever been run from it.)
3. **The profile's first call is on record and says later runs may start.** That is the profile's own rule: one short session, at most $1.00 and ten minutes, started from a terminal by a person on the owner's yes for it by name. It has not been made.
4. The owner's yes for these twelve, given on the review desk on 2026-10-09 (card `q78-does-watching-change-anything`).

A paid run is started from a terminal, by a person. The runner (`scripts/lib/watching-check-paid.mjs`, built on the profile's own) is not on this page's commit; it comes in its own pull request, and its `--dry-run` starts nothing and shows what would be started.

## The free checks (run on 2026-10-09, no model)

[`free-checks/run.mjs`](free-checks/run.mjs) copies the hook the CLI ships into a project made for the purpose and feeds it by hand: the seven events of each harness, and eleven awkward inputs (nothing at all, text that is not JSON, an event it does not know, a session working in another folder, a megabyte of text, a folder it may not write to, and others).

| | |
|---|---|
| Inputs on which it printed nothing, to either stream, and exited 0 | 25 of 25 |
| Of the text put into those payloads (a prompt, a tool's input and result, a last message), kept in the events file | none |
| One call of the hook, median of 200 | 51.5 ms |
| Node starting and doing nothing, median of 200 | 48.3 ms |

So on this Mac (Apple M3 Pro, Node 26.10) a hook call costs what it costs to start Node, about a twentieth of a second, and the hook's own work is a few milliseconds of that. As installed for Claude Code, five of its seven entries run in the background and the harness does not wait for them. It waits for two: the one at a turn's end and the one at the session's end. The full report is [`free-checks/result-2026-10-09.json`](free-checks/result-2026-10-09.json).

This shows what the hook does when it is run. It does not show what a harness does with a hook: that rests on both harnesses' documentation ([`docs/subagents.md`](../../docs/subagents.md) §5), and the twelve runs are the first look at it in practice.

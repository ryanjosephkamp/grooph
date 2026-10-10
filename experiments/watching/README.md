# The watching check

Does watching a session change what it does?

The owner asked for one kind of test before grooph is changed from something that directs agents into something that watches and draws them (decision 0032): that what grooph adds does not get in the way of how a session would work anyway. This page is that test, written before anything is run. It uses what grooph 0.4.1 already ships and builds nothing new into the product.

**Status: written, not run.** Changed once before any run, on 2026-10-10 (the last section). The free checks at the end have been run and need no model. No model session has been started.

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

**What the third arm really holds.** Attaching grooph 0.4.1's MCP server gives a session more than two tools. By Claude Code's documentation, a session starts with the names of a server's tools and with the server's own instructions cut at 2,048 characters, and it reads a tool's description only if it searches for that tool. grooph's instructions are 2,625 characters. The first 2,048 are about authoring graphs and name eight tools this arm withholds. The one sentence about these two tools, "In a coding session: before starting subagents, call grooph_plan with the kinds you will start", begins at character 2,373, so by that documentation it is never handed over. A session that does search for `grooph_plan` then reads its description, which says "Call it again when the plan changes", and the tool's reply says "Start them as you planned". Those are instructions, not an offer, and the new contract will not allow them (decision 0032). All of it is left as it ships, on purpose: this check is of what exists. So a difference in the third arm cannot be divided between the invited sentence and the server's own words. Each record keeps how many characters of instructions the session was handed, which of the two tools they name, and whether it searched.

**One more thing differs between the plain arm and the two watched arms.** In the watched arms the folder `.grooph` is closed to the session's own writes. The harness runs the hook outside the sandbox, and the hook does not refuse to write through a link, so a session that could write there could make it write elsewhere. The hook and the server still write there themselves. The wall is not shown to a session and matters only if one tries to write under `.grooph`; a refused call is counted.

The harness loads a server's tools on demand, through its own tool search, which by its documentation needs no permission. So the offer in the third arm is a real one in the mode these sessions run in, and each record counts the searches a session made and any call that was denied.

Nothing else differs. Every session is headless (`claude -p`), at high effort, on one of three models (below), started from the clean profile of [`experiments/comparisons/profile/`](../comparisons/profile/README.md) by that profile's own runner, so that it loads nothing of the owner's account and can write nowhere but its own folder. Which model a subagent runs on is left to the session: it is one of the things watched. The profile pins what three short names mean (`opus` and `fable` to Opus 5.5, `sonnet` to Sonnet 5.5). For this check `haiku` is left to mean what the harness makes it mean, as it does in anyone's ordinary session. The name a session asked for and the model that answered are both kept.

## Two tasks

Both are made of tasks this repository already holds, unchanged, each with a suite of tests no session is shown.

- **`one`**, a narrow task: `printkit`, the task of [`comparisons/heterogeneous-critic`](../comparisons/heterogeneous-critic/), worded as that project's task-alone prompt words it.
- **`four`**, a wide task: one repository holding four packages side by side, each a task as its own project keeps it: `settingskit` ([`review-gate-2`](../comparisons/review-gate-2/)), `textwrap` ([`spec-then-loop`](../comparisons/spec-then-loop/)), `csvline` ([`red-team-loop`](../comparisons/red-team-loop/)) and `semver-mini` ([`grind-loop`](../comparisons/grind-loop/)). The prompt gives the four tasks one after another, each worded by the comparison protocol's rule for a task alone ([`docs/comparisons.md`](../../docs/comparisons.md) §1), with its folder named. The four have nothing to do with each other, so handing them to subagents is an open choice and never a need.

Two tasks, three arms, twice each: twelve runs, one at a time, in this order: `one` plain, `four` plain, `one` watched, `four` watched, `one` invited, `four` invited; then the same six again.

## Three models

The twelve are run three times over, as three blocks, each on one model for the session itself:

| Block | The session's model | Why |
|---|---|---|
| `sonnet` | Claude Sonnet 5.5 (`claude-sonnet-5-5`) | The economical middle, and the check as first written. |
| `opus` | Claude Opus 5.5 (`claude-opus-5-5`) | What the owner's own sessions run on, so where watching has most to stay out of the way. |
| `haiku` | the harness's current Haiku, asked for by its short name | Where a nudge would show most, if one shows anywhere. |

Thirty-six runs. The recorder hands a session nothing to read, so the watched arm should not depend on the model. The invitation, and what a session chooses to do with subagents, may. A block is started by a person and the driver reads its records before the next is started; the order is `sonnet`, `opus`, `haiku`. If the harness will not start a session on Haiku at high effort, the `haiku` block is not run, and this page says so in a dated note.

## What is measured, and from where

Every arm is measured the same way, **from the harness's own files in the clean profile, never from grooph**: the session's transcript, and the file the harness keeps beside each subagent's transcript.

- Subagents: how many, of which types, on which models, how deep, started in the foreground or the background.
- The session: turns, tool calls by tool name, minutes, tokens, and the cost the harness reports.
- The result: how many of the unseen tests pass, for each package.
- The footprint: how many of the session's tool calls name `.grooph` or `.claude/settings.json`, or get a result that shows either (`git status` lists the hook's own file as untracked while a watched session runs). Counts; what a call said or returned is not kept.
- In the watched arms, the hook's own file is kept, and set beside the transcripts: a subagent the harness started with no start line, a start with no stop, a line for a subagent that was never started.
- In the invited arm: whether either tool was called, how many times, and what was said. That text is kept. It is the session's own statement and it is what the arm is for.

## How it will be read

Every row is published, one table for each block, with every run's record.

- For any measure, **"no difference seen"** is said of two arms, within a block, only when their values overlap on both tasks. Nowhere is "no effect" said. Twelve runs of one model can show a large effect and cannot show a small one. The three blocks are set side by side and are not added together.
- A difference is reported as seen, with both runs' values.
- Agreement between the hook and the transcripts is given as counts.
- What the invitation costs is the invited arm's turns, tokens and cost beside the watched arm's, as ranges.

What it cannot say: anything about another model, another harness, a session a person is typing into, a run of hours, an agent team, or whether the new direction is worth building.

## Limits

- A run of `one` stops at 25 minutes and a run of `four` at 60, and at a dollar ceiling that goes by its block: $2.00 and $6.00 on `sonnet`, $5.00 and $15.00 on `opus`, $1.00 and $3.00 on `haiku`. These are the runner's watchdog; no session is told of them.
- The whole check stops at **$140.00** on a ledger of its own, `ledger.json` in this folder. A cost that is not yet settled counts at its ceiling. The thirty-six ceilings add up to $192.00, more than the cap, on purpose: a run is not started unless the ledger has room for its ceiling, so the check ends early if the runs cost far more than expected.
- A run that fails for a reason outside the session (the sign-in, the network, a usage limit) may be run once more, with the reason written beside it.
- A run is recorded before its result is used (decision 0015): the harness's output saved as it runs, a ledger row with the session's id and reported cost.

## What has to hold before the first run

1. This page is on `main`. After the first run nothing here changes without a dated note saying what and why.
2. `node scripts/lib/compare-profile.mjs --check` holds on every line. (It did on 2026-10-09: the profile is signed in, and nothing has ever been run from it.)
3. **The profile's first call is on record and says later runs may start.** That is the profile's own rule: one short session, at most $1.00 and ten minutes, started from a terminal by a person on the owner's yes for it by name. It has not been made.
4. The owner's yes, given on the review desk: for the check on 2026-10-09 (card `q78-does-watching-change-anything`), and on 2026-10-10 for the runner, the first call and the scoring (card `q80-the-twelve-runs-three-yeses`), where he also asked whether other models should be tried and left the limits to the driver.

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

## Changed before any run

**2026-10-10.** Three things, each before the first model session and on the owner's word of that day (card `q80-the-twelve-runs-three-yeses`: he approved the runs, asked whether Opus or Haiku should be tried beside Sonnet, and said the limits could be raised where the driver thought it right).

- **Three models where there was one.** The twelve runs are made on Sonnet 5.5 as written, and again on Opus 5.5 and on Haiku ("Three models").
- **The limits.** Minutes went from 15 and 40 to 25 and 60, so that a run is not cut off for being slow. The dollar ceilings now go by block, and the cap went from $45.00 to $140.00 for thirty-six runs.
- **`haiku` is no longer pinned for this check.** The profile pinned that short name to `claude-haiku-4-5-20251001`. A session in ordinary use has no such pin, and what a session does with subagents is one of the things watched, so the name is left to the harness and the model that answered is recorded.

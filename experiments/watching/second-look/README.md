# A second look at watching, on work that calls for subagents

Does watching a session change what it does, when the session hands work to subagents?

The watching check ([`../README.md`](../README.md), run on 2026-10-10) asked that of thirty-six sessions, and thirty-five of them used no subagent ([`../RESULTS.md`](../RESULTS.md)). So it said little about sessions that delegate, which is what the product is for. It also found that a session can see a recorder installed inside its project, and did not try the remedy. This page is the second look, written before anything is run. It is read by the first check's rule, so that the two can be set side by side.

**Status: nothing has been run.** Every run is the owner's to start, from a terminal, one block at a time. This page is complete before the first run, and after the first run nothing here changes without a dated note saying what and why. Nothing on it is a claim about grooph (decision 0024).

## What is asked

In order of weight:

1. **On work that is delegated, does a watched session behave differently from a plain one?**
2. **Is the hook's record true when there are several subagents?** Agent by agent: its start, each stop, who started it and what type it is, against the harness's own files.
3. **Does a session notice a recorder that is installed outside its project?**

## Three ways of running one task

| Arm | What is different |
|---|---|
| **`plain`** | Nothing of grooph is in the project, in the session's settings or on its path. |
| **`watched`** | The recorder is in the project: `grooph hooks install` was run in the folder before its one commit, with no other flag, as in the first check. |
| **`outside`** | The recorder is outside the project, as slice 0108 installs it: `grooph hooks install --user`, and `grooph hooks watch` for the session's folder. The hook's file and its events are in a folder of grooph's own outside the session's folder, the entries that run it are in the harness's user-level settings, and the project holds nothing of grooph. |

The prompt is the same in every arm, to the letter: the task, then one sentence.

> Use subagents for the parts of this that can be done side by side.

The first check said "You may use subagents for any part of this if you judge that it helps. You do not have to.", and one session in thirty-six used them. Here the task asks. It is a person's request, of the kind the product is for, and it says nothing about how many subagents, which kind, on which model or in what order: all of that is the session's, and is what is watched. Because the sentence is in the plain arm too, no arm differs by it.

**The invitation to state a plan is left out.** The first check found that what grooph's server hands a session never reaches the sentence about its two tools ([`../RESULTS.md`](../RESULTS.md), question 2). That is slice 0105's to repair first. No arm attaches a server.

**What the `watched` arm holds.** The hook is installed by the grooph of the checkout the runner is started from: the three files of the first check (`.claude/settings.json`, `.grooph/hooks/grooph-event.mjs`, `.grooph/hooks/grooph-events-push.mjs`), from version 0.4.1 with what `main` has added since (the hook writes through no link since #190, and slice 0108 changes its file). Each record keeps the checkout's commit and the checksum of the hook's file. As in the first check, the folder `.grooph` is closed to the session's own writes, because the harness runs the hook outside the sandbox and a session that could rewrite the hook's file could run what it liked there. The wall is not shown to a session; a refused call is counted.

**What the `outside` arm holds, and where it is not a person's own install.** Every session of this look starts from the clean profile of [`experiments/comparisons/profile/`](../../comparisons/profile/README.md), whose configuration folder stands in for `~/.claude`. For a run of this arm the runner installs the recorder at the user's level of that profile and of nothing else: the entries go into the profile's own `settings.json`, and grooph's own folder is one made for the run under the profile's home, outside the session's folder. The owner's real `~/.claude`, `~/.codex` and `~/.grooph` are never touched. When the run ends the profile's settings go back to the repository's, and that folder is moved aside with the session's. The session's command and environment are the plain arm's, to the letter: the hook finds grooph's folder from where its own file is, so no variable names it.

The install is made by a launcher, at the moment the session is started. The profile's own runner writes the profile's settings just before it starts the harness, so an install made any earlier would be written over. The launcher is the program that runner starts for the session and for nothing else: it runs the two commands, and then becomes the harness (the same process, in the same process group, with the arguments and the environment it was given). If either command fails it starts nothing: no session runs, nothing is spent, and the run has no record and is not a result.

Three things differ from a person's own install:

- **A session of this profile cannot read outside its own folder at all.** The profile refuses the file tools any path outside it, and with the sandbox on a command cannot read there either: the profile's first call showed a command could not list the folder above its own. A person's ordinary session can read its own home. So in this arm a session cannot come upon the recorder by reading. What the arm can show is whether anything else gives it away: what the harness hands a session when a hook is installed at the user's level, and any attempt to look, which is refused and counted. What a session free to read `~/.grooph` and `~/.claude` would do, it cannot show.
- grooph's folder is not `~/.grooph`.
- The list of watched folders holds the session's folder and no other.

Nothing else differs between arms. Every session is headless (`claude -p`), at high effort, sandboxed, with no network. Which model a subagent runs on is left to the session. The profile pins three short names of a model (`opus` and `fable` to Opus 5.5, `sonnet` to Sonnet 5.5) and, as in the first check, leaves `haiku` to the harness; the name a session asked for and the model that answered are both kept. The profile refuses a session the tool that sends a message to an agent, so a subagent that has finished cannot be handed more work: each subagent is expected to run once.

## Two tasks

Both are made of tasks this repository already holds, unchanged, each with a suite of tests no session is shown. Each package's task is worded by the comparison protocol's rule for a task alone ([`docs/comparisons.md`](../../../docs/comparisons.md) §1), with its folder named, as the first check's wide task was.

- **`four`**: the first check's wide task, to the letter up to the closing sentence. One repository, four packages side by side: `settingskit` ([`review-gate-2`](../../comparisons/review-gate-2/)), `textwrap` ([`spec-then-loop`](../../comparisons/spec-then-loop/)), `csvline` ([`red-team-loop`](../../comparisons/red-team-loop/)) and `semver-mini` ([`grind-loop`](../../comparisons/grind-loop/)).
- **`six`**: those four and two more, in the same way: `printkit` ([`heterogeneous-critic`](../../comparisons/heterogeneous-critic/), the first check's narrow task) and `textkit` ([`review-gate`](../../comparisons/review-gate/)). It is the widest task this repository can make from tasks whose unseen suite tests what the task states. The seventh, `taste-polish`, is left out: most of its suite tests a reference no session is shown.

The packages have nothing to do with each other. `textkit`'s task, as its own project words it, says of its unseen cases that "the critic judges against it"; no critic is given here, and the wording is left as kept.

### Why these should bring a session to delegate

This is a bet, argued from records and not from a trial run. No session was started to see whether a task works.

- **The first check's own records.** Given the four packages and leave to use subagents, Sonnet 5.5 and Opus 5.5 did them one after another, in three to six minutes and 27 to 51 turns, twelve times of twelve: the work was small enough to do alone and nothing asked otherwise. The one session that did split (`haiku/four/invited-1`) started four `general-purpose` subagents in the background, one for each package, and waited for them. So where a model splits this task, it splits it by package, and a package is a part that can be done beside the others.
- **This project's own sessions** ([`handoffs/0104-the-live-graph/RECORDS.md`](../../../handoffs/0104-the-live-graph/RECORDS.md) §1 and §3). The thirty-six sessions a researcher read on the owner's Mac started 137 subagents: 134 at depth one, 127 of the type `general-purpose`, 133 in the background, and at most five at once. That page holds no prompt, so it cannot say what brought a session to delegate. It does say what delegating looks like when it happens here, and that is the shape this look expects: one `general-purpose` subagent for each independent piece, at depth one, several at once.
- **The request.** The sentence asks for it, in every arm.

**What would show the bet was wrong, after one block.** If fewer than fifteen of a block's eighteen sessions start any subagent, or if on either task some arm has no run that does, the tasks did not do what they were chosen for. That is then reported as the block's result, and the next block is not started on this page as it stands.

**What these tasks will probably not bring**, and so what this look may be unable to test: a subagent that starts a subagent, a type other than `general-purpose`, a subagent started in the foreground, a run that fails, and a subagent run a second time. Each is counted if it happens. The record's truth about a parent other than the session itself is tested only if some subagent starts another.

## Three rounds, in two blocks

Two tasks, three arms, three times each: eighteen runs a block, one at a time, in three rounds of six. The arms change places from round to round, so that each arm goes first once, second once and last once:

| Round | The six runs, in order |
|---|---|
| 1 | `four` plain, `six` plain, `four` watched, `six` watched, `four` outside, `six` outside |
| 2 | `four` watched, `six` watched, `four` outside, `six` outside, `four` plain, `six` plain |
| 3 | `four` outside, `six` outside, `four` plain, `six` plain, `four` watched, `six` watched |

The `opus` block makes the rounds as the table has them. The `sonnet` block starts from the second row: its three rounds are the table's 2, 3 and 1, so its first run is `four` watched. With one order for both blocks, whatever a block's first run pays would fall on `four` plain in both, the same way round, and "seen in both blocks" (below) reads exactly that. A block's rounds are numbered as it makes them, and the tables say which run was its block's first.

**Why the arms change places.** In the first check the plain arm always went first, and on two of the three models the first run of a block paid for something the later ones did not: on Sonnet the first narrow run wrote 29,087 tokens to the cache against 10,721 to 12,785 in the five after it, and cost $0.20 against $0.11 to $0.14; on Haiku it wrote 32,932 against 14,180 to 19,536. (On Opus it did not stand out: 17,666 against 11,912 to 16,898.) The first check's page sets the arms' costs side by side without saying so. A fixed order puts whatever a place in the order costs on one arm.

**Why three rounds and not two.** The rule of reading (below) says "a difference" when two arms' values do not overlap. With two runs an arm, two arms that do not differ at all fail to overlap on a task one time in three by chance alone, and on at least one of two tasks five times in nine. With three runs an arm it is one time in ten, and about one in five on at least one of two tasks. (This is counting: of the ways to put the values of both arms in order, the share in which one arm's all lie below the other's. It supposes no two values are equal; where values tie, as counts of subagents will, a difference is rarer still.) The first check had two.

The eighteen are run once on each of two models, as two blocks:

| Block | The session's model | Why |
|---|---|---|
| `opus` | Claude Opus 5.5 (`claude-opus-5-5`) | What the owner's own sessions and this project's lanes run on, so where watching has most to stay out of the way. It is first because the runs are wanted before the owner's weekly allowance resets on Monday 2026-10-12 at 11:00 a.m. Eastern: if there is time for one block, it is this one. |
| `sonnet` | Claude Sonnet 5.5 (`claude-sonnet-5-5`) | The economical middle, and the first check's first block. |

Thirty-six runs. No block is planned on Haiku: the hours before the reset go to the two models this project works on, and in the first check the short name `haiku` was answered by Haiku 4.5. A Haiku block could be added later by a dated note, and would name its model in full. No block uses Fable or Astra (decision 0031).

A block is started by a person, by name, and the driver reads every record of it before the next is started. The runner refuses a block while the block before it has no whole round, or has a round begun and not finished.

**Both blocks are run from one built checkout, at one commit.** The `watched` arm's hook is that checkout's own file, and slice 0108 changes it: two blocks from two checkouts would differ by more than their model. Each record keeps the commit and the checksum of the hook's file. The runner refuses a run from another commit, or with another hook, than a run already recorded, unless it is told so by name (`--another-checkout`); the record then says so, and the results page names the run under its block's table.

### If the clock runs short, or slice 0108 is not merged

- **A block may be stopped at the end of a round.** A block with two whole rounds is read by the rule with what two runs an arm can show (above). A block with one whole round is published as rows and is not read by the rule at all.
- **Without the `outside` arm.** The recorder cannot be installed outside a project until slice 0108 is on `main` and built in the checkout the runner is started from. Until then the runner refuses a run of that arm, and a block may be started without it: its `plain` and `watched` runs are made in the same order, and its `outside` runs are left. That block answers the first two questions for the recorder inside the project. It leaves unanswered the third question whole, and the first question for a recorder outside the project.
- **`outside` runs made later.** They may be made afterwards, into the same block, on the owner's word. They are then compared with `plain` runs made hours or days before, and they come from another checkout: a block started before slice 0108 was merged ran its `watched` arm with the hook from before it, and the later `outside` runs run the hook from after it. So they are made with `--another-checkout`. The results page says how long after, from which commit, and whether the harness's version was the same; if the version was not the same, they are published as rows and not read against the other arms.
- **What waits.** If there is not time for the `sonnet` block before the reset, it waits for the owner's word after it. Nothing here depends on the two blocks being made on the same day: they are set side by side and are not added together.

## What is measured, and from where

Every arm is measured the same way, **from the harness's own files in the clean profile, never from grooph**: the session's transcript, each subagent's transcript and the file the harness keeps beside it, and the result the harness printed. What is kept is names, counts and times. Nothing a session read, wrote or said is copied into a record, beyond what the first check's records keep (the final reply, in the harness's own output).

**The delegation.** Whether any subagent was started; how many; of which types; on which models, asked for and answered; how deep; in the foreground or the background; how many were running at once; and the harness's own count of them (`subagent_stats` in its result: started, completed, failed, killed, refused), set beside the count of transcripts.

**The session.** Turns, tool calls by tool name, minutes by the runner's clock, tokens and the cost the harness reports, with the tokens written to the cache kept apart. Turns are the session's own: the first check's one delegating run reports 5 turns for work its four subagents did in 63 messages. So turns are read between arms only where both delegated.

**The result.** How many of the unseen tests pass, for each package. With no work done at all `csvline` passes 38 of its 73 and the other five packages pass none: that is where each count starts.

**Whether the recorder was noticed**, counted the same way in every arm, so that the plain arm shows what the count picks up when there is nothing to notice:

- tool calls, the session's and its subagents', that name `.grooph` or `.claude/settings.json`, and tool results that show either: the first check's two counts, unchanged;
- tool calls that name, and results that show, any of the user-level places: the profile's own `settings.json`, grooph's own folder for the run, the hook's file name, or a variable of grooph's in the environment (there should be none), with how many of those calls were refused;
- whether the session's final reply names any of them. The first check's page counted this by reading; here the runner counts it.

Counts only: what a call said and what came back are not kept.

**The record's truth**, in the `watched` and `outside` arms: the hook's own file is kept, and the runner sets it beside the harness's files agent by agent. For each subagent the harness's files show:

| | From the harness's files | From the hook's file |
|---|---|---|
| Its start | it has a transcript | a start line under its id |
| Each stop | how many times it ran, and how the harness says each run ended | its stop lines |
| Who started it | the file beside its transcript: the session, or the subagent it names | the line the hook writes for the call that started it |
| Its type | the file beside its transcript | its start and stop lines |

Every difference is written into the run's result by its kind, with the agent's id: no start line; fewer or more start lines than runs; fewer stop lines than runs; more stop lines than runs; no stop line for a run the harness's files do not show ending either (a subagent still running when the session's files stop); a type that differs; a parent that differs; no line that names its parent; and a line for an agent the harness has no file for. Three things are expected, from this project's own sessions ([`RECORDS.md`](../../../handoffs/0104-the-live-graph/RECORDS.md) §2), and are named apart from differences when they are met:

- **a run that failed has no stop line**: the harness says the run failed, and the hook was not called for it;
- **a foreground child's parent is known only at its end**: the line that names who started it is written when the call returns;
- **stop lines that name an agent and no type**: the harness's own helpers, which leave no transcript.

The hook was installed without `--tools`, as `grooph hooks install` installs it, so it has a line for a call that starts a subagent and for no other call.

## How it will be read

Every row is published, one table for each block, with every run's record. The tables are made from the records by a script that CI runs.

- For any measure, **"no difference seen"** is said of two arms, within a block, only when their values overlap on both tasks. Nowhere is "no effect" said.
- A difference is reported as seen, with every run's value on both sides, and with the sentence that by chance alone such a difference is expected about one time in five (three rounds; "Why three rounds", above).
- **Five measures are read by the rule**: unseen tests passed (the packages' sum), the cost the harness reports, minutes, how many subagents were started, and the tokens the session and its subagents put out. Everything else is published in the rows and described, and is not called a difference or the lack of one.
- **How many readings there are.** Five measures by three pairs of arms is fifteen readings a block, each with about one chance in five of a "difference" where nothing differs. So about three differences a block are to be expected from chance alone, and a difference seen in one block is given no weight by itself.
- **"Seen in both blocks"** is said of a difference only when the same two arms fail to overlap on the same task, the same way round, on the same measure, in both blocks. By chance alone that is about one time in a hundred for a measure and a pair of arms. It is the only reading given weight, and fifteen readings wear it down too: were they independent, which they are not, there would be about one chance in seven that some reading is seen in both blocks by chance. It is still not "an effect": it is two models, on two tasks, in one harness. The blocks are set side by side and are not added together.
- Agreement between the hook and the harness's files is given as counts by kind, for each arm, with every difference listed.
- Whether the recorder was noticed is given as counts for each arm, the plain arm's beside them.

### What this cannot show

- **Anything small.** With three runs an arm, an arm would have to move a measure past the whole spread of the other arm's runs to be seen at all. In the first check, of two plain runs of the wide task on one model, one cost a fifth more than the other on Opus and nearly twice the other on Haiku. Subagents may widen that.
- **With two runs an arm** (a block stopped after two rounds): a "difference" is then expected one time in three on a task by chance alone, so a difference seen means almost nothing by itself, and "no difference seen" would be said less than half the time of two arms that do not differ.
- **That watching has no effect.** A look of this size can fail to see a difference; it cannot show there is none.
- **Why** a difference is there, if one is seen. The `watched` arm differs from the plain one by three files in the folder, by a wall on one folder and by the hook being run; this look does not take those apart.
- Anything about a session a person is typing into, a run of hours, an agent team, a subagent that is resumed, another harness, another version of this one, or any model but the two.
- Anything about a parent other than the session, a failed run or a foreground child, unless the sessions happen to produce them.
- Whether a session would notice a recorder installed in a person's own `~/.grooph`. The `outside` arm is that install in a clean profile, where a session cannot read outside its folder: it can show that nothing reaches a session by another way, and not what a session that can look would find.
- Whether the direction is worth building.

## Limits

These are a proposal until the first run: the driver and the owner may change them before it, and not after it without a dated note.

| | A run of `four` | A run of `six` |
|---|---|---|
| `opus` | $12.00, 40 minutes | $18.00, 60 minutes |
| `sonnet` | $5.00, 40 minutes | $8.00, 60 minutes |

- These are the runner's watchdog; no session is told of them. A run the watchdog cuts off is a result, and is scored as it stands.
- The whole look stops at **$200.00** on a ledger of its own, [`ledger.json`](ledger.json) in this folder. A cost that is not yet settled counts at its ceiling. A run is not started unless the ledger has room for its ceiling.
- **At the ceilings**, by list price, the thirty-six runs would come to **$387.00**: $270.00 for the `opus` block (nine runs at $12.00 and nine at $18.00) and $117.00 for `sonnet` (nine at $5.00 and nine at $8.00). That is more than the cap, on purpose, as in the first check: the look ends early if runs cost far more than expected.
- **What is expected** is far less, and is a guess: in the first check a run of `four` done by one session cost $1.12 to $1.50 on Opus and $0.47 to $0.64 on Sonnet, and the one run that delegated cost $0.52 against $0.29 to $0.62 for its five peers on that model. If delegating doubles a run and `six` costs half as much again as `four`, a block is about $60 on Opus and $25 on Sonnet. The dollars are the list price the harness reports; on the owner's subscription they are usage and not a charge.
- **Hours.** In the first check a run of `four` took 2.8 to 6.3 minutes with no subagent, and its three blocks of twelve took about 23, 39 and 27 minutes. Here a block has eighteen runs of wider work. One to two and a half hours a block is the estimate, and nobody knows until the first runs are in. At the minute limits a block would take fifteen hours; that is the watchdog's bound and not an expectation.
- A run that fails for a reason outside the session (the sign-in, the network, a usage limit) may be run once more, with the reason written beside it.
- A run is recorded before its result is used (decision 0015): the harness's output saved as it runs, and a ledger row with the session's id and reported cost, opened before the session starts.

## What has to hold before the first run

1. This page is on `main`.
2. `node scripts/lib/compare-profile.mjs --check` holds on every line.
3. **The profile's first call still stands.** It is on record from 2026-10-10 and says later runs may start, for version 2.1.289 of the harness and the profile as the repository has it. It stood on 2026-10-11. If the harness has been updated since, or the profile changed, the runner refuses and the first call is made again first: one short session, at most $1.00, the owner's to start.
4. **The owner's decision on scoring is recorded in this look's own ledger, for this look by name.** A run is scored by running the unseen suites against the packages a session left, and that runs code a session wrote, outside the sandbox and with this account's rights. The first check's decision is not read for this one. Until the field is filled the runner starts nothing and scores nothing.
5. The owner's word for each block, given to the runner in the driver's words (`--spend --go "…"`).
6. For the `outside` arm: slice 0108 is on `main`, the checkout is built (`pnpm -r build`), and the runner's own rehearsal of the install, made in a scratch folder with no session, leaves what this page says it leaves.
7. **The `outside` arm's profile is not the profile the first call tried.** It differs by the hook's entries in the profile's settings, and by nothing else. That is shown and not supposed: the rehearsal, and then the record of every run of the arm, give the profile's settings three times: the repository's before the install; the repository's and exactly what `grooph hooks install --user` writes, during the session; and the repository's again after it. After every run of the arm the runner makes the profile's own check (`compare-profile.mjs --check`) and stops if any line does not hold. What the first call showed of the walls is taken to hold with those entries added; no call has tried that.

## How a block is started

From a terminal, by a person, and never from a tool with a time limit of its own. The runner is `scripts/lib/watching-second-look-paid.mjs`.

```bash
node scripts/lib/watching-second-look-paid.mjs --status
node scripts/lib/watching-second-look-paid.mjs --all --block opus --dry-run
node scripts/lib/watching-second-look-paid.mjs --all --block opus --spend --go "<the driver's words for this block>"
```

The first two start nothing: `--status` says where everything stands, and `--dry-run` builds each run's folder, says what would be started and what would refuse it, and takes the folder away. The third makes every run of the block still to come, one at a time, and never goes on into the next block. `--block sonnet` is the second block. Two more words go with the third:

- `--through-round 2` (or `1`) stops the block at the end of that round.
- `--without-outside` makes the block's `plain` and `watched` runs and leaves its `outside` runs for later.

The runner stops by itself, and starts nothing more until a person has looked, when the harness ended a run, when a record could not be kept whole, when the launcher of an `outside` run could not install the recorder (no session was started, and the same command starts that run again), when the profile's own check does not hold after an `outside` run, or when a session of the `watched` or `outside` arm left no file of the hook's: such a session was not watched, and the runs after it would be spent on an arm that is not what its name says.

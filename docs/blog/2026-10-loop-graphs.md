# Loop graphs: draw the loop your agents run, and make sure it can end

*A draft for Ryan to edit. Written in his voice from the project's own records; every number here has a file behind it. Where the page shows a live graph, the line that embeds it is in the source.*

I run a lot of coding agents. Some days a dozen at once, on two accounts, in the cloud and on my Mac. The work itself goes well. What goes badly is everything around it: a loop that never ends, a loop that ends somewhere I did not choose, an agent that reviews its own work and finds it good, and my not knowing, at seven in the morning, what is running.

So I built a small tool for the part around the work. It is called **grooph**, it is open source, and it does three things: it lets you **draw** the loop, it **checks** that the loop can end, and it hands the drawing to the harness you already use. It never runs an agent itself.

## What a loop graph is

Here is one. A builder writes the change. A critic, in a context of its own, reads it against a checklist. If the critic says no, the builder goes again. If it says yes, a person approves the merge. The loop turns at most four times and may send out at most ten pieces of work.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/review-gate-dark.svg">
  <img src="../assets/review-gate-light.svg" alt="A loop graph: a builder, a critic, a human gate before the merge, and a stop. A dashed line sends work back from the critic to the builder." width="420">
</picture>

<!-- When the embed route is live (handoff 0056), this line shows the same graph, live: pan it, zoom it, tap a node to read its brief.
<iframe src="https://ryanjosephkamp.github.io/grooph/#/embed?EMBED_PAYLOAD" title="A loop graph: review gate" width="100%" height="560" style="border:0" loading="lazy"></iframe>
-->

That is the whole notation. Boxes are agents. Diamonds are checks a machine can run. The orange box is a person. A dashed line that curls back is a loop, and every loop carries its **stops**, in order: what ends it, and what happens then.

The graph is one small JSON file. A model can read it and rewrite it in one pass. It diffs. It has a version.

## What grooph checks

Before a graph may be exported, the validator has to pass it. It refuses, with a code and a sentence saying what to fix:

- a loop with no stop;
- a loop that polishes to taste with no bar that says "good enough";
- a critic that shares the builder's context, and so can only agree with it;
- two agents that own the same file;
- a step that cannot be undone (a merge, a publish, a payment) with no person in front of it.

There are 35 rules in all, each with a failing example in the repository. None of them is clever. They are the mistakes I kept making.

`grooph explain` says the result in plain words:

```
Loop "Review": at most 4 rounds.
  stops when the acceptance bar is met, the loop is left by its pass edges
  stops after 4 rounds, the run halts and reports to a person
  stops at 10 dispatches, the run halts and reports to a person

Human gates:
  Merge approval: The critic passed the change against the checklist. Merge it? (before Done, Builder)

Worst case: at most 4 rounds of looping in all (nested loops multiplied); budgets: 10 dispatches; 1 place where a person must say go.
```

## What it hands your harness

`grooph export` turns the graph into a package in the harness's own units. For Claude Code that is a lead brief, one subagent per agent in the graph, the loop's policy, the list of gates, and a contract for the notes the run must leave. You start a session, point it at the package, and the session runs the graph. Your harness does the work. grooph is not there when it happens.

Most of the time I do not draw the graph myself. I ask my agent to: `/grooph-design a builder and a critic that loop until the checkout tests pass, and ask me before merging`. It proposes two or three graphs, I pick one on my phone, and it places the package.

## What I measured, and what I did not find

I want to be exact here, because it is the part people skip.

**Twenty templates, twenty recorded runs.** Every template in the library has been run for real, at least once, on a small task built so its point could show, and the record is in the repository: what ran, which stop ended it, what it cost. Some came back red, and the red ones are published with their reasons.

**One paired comparison.** Four templates. For each, three arms under the same conditions: the graph's package; the same design written out as one prompt; and that prompt in a plain retry loop. A held-out test suite scored each run, and a blind judge ranked them.

**The graph did not win.** On every project every arm reached the same held-out score. The judge never ranked a graph run first. On the simplest project the graph cost about twice what the prompt cost, for the same result. The prompt had kept the design (the roles, the routing, the loop) and a strong model followed it.

**Where the arms differed, it was in stopping.** One prompt run kept attacking its own work until it hit the $9.00 ceiling, at $9.02 and almost 25 minutes. Both graph runs of the same project stopped by the graph's own edge, for $2.63 and $3.57.

So this is what I claim, and all I claim:

> grooph is shown to bound and record autonomous work, and to hold a design as a contract while it runs. It is not shown to raise quality over the same instructions given as a prompt, on small tasks.

A second study, on tasks built so a first pass fails and the loop has to turn, is designed and has not run yet. If it says the same thing, I will keep saying this.

## Seeing what is running

The other half of the problem is sight. grooph installs a hook in the harness that appends one line to a file when a session or a subagent starts or stops: an id, a name, a time. Never a prompt, a file name, or a reply. From those lines it draws what is running now.

For work that spans sessions there is a second, smaller drawing: an **operation map**. Sessions, the people they work with, and what carries work between them (a branch, a pull request, a message, a person). Here is the map of the two days in which the newest parts were built: one session driving, others building in parallel, and me.

![An operation map: one person at the top, three lanes of sessions, and numbered lines for each handoff between them](../../handoffs/briefs/plan-2026-10-04/build-map.svg)

grooph's summary of that map is one line: *9 sessions, 19 handoffs, 9 of them waiting on a person.* That person was me. Nearly half of what moved in my own operation moved only when I carried it. I would not have guessed that, and seeing it is what the map is for.

### A hook that may not speak must still leave a trace

One story from this, because it changed the design.

The hook is built to be silent. It prints nothing and never fails a turn, so that watching can never change what an agent does. I added a second hook that sends those lines to a branch of their own at the end of each turn, so another machine can read them.

The first time it ran in a cloud session, nothing arrived, and nothing said why. A cloud session starts with no branch checked out; the sender had no name for its branch, stopped, and stayed silent as designed. Three turns were lost without a sign.

The fix was not to make it louder. It still says nothing to the session. It now writes how each push went into a small file beside the events, and one command reads it. Silent is not the same as traceless. I had built the first and forgotten the second.

Since then the cloud sessions on another project of mine publish their events this way. On the first day five of them sent 163 lines: ids, tool names, times and a folder's name, and nothing else. Every line was read before I left it on.

## Try it

```bash
git clone https://github.com/ryanjosephkamp/grooph.git && cd grooph
pnpm install && pnpm -r build && scripts/install-local.sh
grooph template use grind-loop --name "Fix the flaky test" --set task="make the checkout test pass ten times in a row" --set test-command="pnpm test checkout" --out flaky.grooph.json
grooph validate --for-export flaky.grooph.json
grooph image flaky.grooph.json --out flaky.png
grooph export flaky.grooph.json --target claude-code --into .
```

Or open the app, which needs no install and keeps everything on your device: [ryanjosephkamp.github.io/grooph](https://ryanjosephkamp.github.io/grooph/).

It is MIT licensed and will stay open. If you draw a loop of your own, I would like to see it.

## What it is not

It is not a runtime, and it is not a hosted studio. It does not call a model. It will not make a weak plan strong. It is a drawing with a checker in front of it, and a record behind it.

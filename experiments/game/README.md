# Arena: the game experiment, on paper

One browser game, built from one spec and one loop graph, once in Claude Code and once in Codex, each in its own public repository, six hours each. This folder is the experiment before it is run, so that the owner can read it and say yes.

**Nothing here has been run.** No model session was started, no repository was made, no asset was downloaded.

| | |
|---|---|
| [`SPEC.md`](SPEC.md) | the game, for whoever builds it: what is fixed, seven milestones, what to drop when time is short, and the test surface |
| [`arena.grooph.json`](arena.grooph.json) | the loop graph both sessions run: a person at the start and at the end and nobody between, a critic that plays every milestone, a check that keeps what worked working |
| [`acceptance/`](acceptance/) | the checks no builder sees, and the proof that they can pass and can fail |
| [`PROTOCOL.md`](PROTOCOL.md) | what keeps it fair, what is written down, what the result can and cannot say, and what must exist before it runs |

The page for the owner is [`handoffs/briefs/game-experiment.html`](../../handoffs/briefs/game-experiment.html).

```bash
pnpm -r build
node packages/cli/bin/grooph.js validate --for-export experiments/game/arena.grooph.json
node packages/cli/bin/grooph.js export experiments/game/arena.grooph.json --target claude-code --into "$TMPDIR/game-package" \
  --models frontier=claude-opus-5-5,strong=claude-sonnet-5-5,fast=claude-sonnet-5-5
node packages/cli/bin/grooph.js image experiments/game/arena.grooph.json --out "$TMPDIR/arena.svg"
```

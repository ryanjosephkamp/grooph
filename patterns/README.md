# Pattern library

The built-in templates: one graph document per named pattern from spec §10, each with a `template` block (docs/templates.md). Every pattern validates with no errors once its slots are filled with their examples; the warnings a pattern raises on purpose are listed in `<id>.expect.json` beside it. Gauntlet-style polish is `taste-polish`, one bounded entry among many, never a default.

Use one by name, without copying anything:

```bash
grooph template list
grooph template show review-gate
grooph template use review-gate --name "Slugify" --set task="Add a slugify function." --set test-command="pnpm test" --set checklist=docs/REVIEW-CHECKLIST.md --out slugify.grooph.json
grooph template insert human-gated-irreversible --into slugify.grooph.json --set action="Merge the branch into main." --set irreversible=merge --write
```

The library is published with the web app at <https://ryanjosephkamp.github.io/grooph/patterns/index.json>, so `grooph template add <id>` fetches one without a clone.

| Pattern | Kind | When to use | Cost · speed · rigor | Slots |
|---|---|---|---|---|
| [`contradiction-seeker`](contradiction-seeker.grooph.json) Contradiction seeker | graph | A claim can be broken by one concrete counterexample (a property, an invariant, an edge case), and a bounded search for it is worth more than an open-ended review. | low · fast · standard | `task`, `test-command`, `claim` |
| [`debate-then-build`](debate-then-build.grooph.json) Debate then build | graph | Short adversarial planning, then a small build graph: the right approach is genuinely unclear and a wrong choice is expensive to undo. | medium · medium · standard | `task`, `test-command` |
| [`dual-bar`](dual-bar.grooph.json) Dual bar | graph | The work needs both a ship line and a directional aspiration: good enough to ship is clear, and better is worth pointing at without ever blocking. | medium · medium · standard | `task`, `test-command`, `ship-line`, `aspiration` |
| [`fresh-grind-rare-judge`](fresh-grind-rare-judge.grooph.json) Fresh grind, rare judge | graph | Cheap iteration most steps, an expensive critic at phase boundaries: long work splits into phases that tests can drive but only judgment can sign off. | medium · medium · high | `task`, `test-command`, `phase-checklist` |
| [`grind-loop`](grind-loop.grooph.json) Grind loop | graph | Done and good are the same: tests, types or a task list supply the back pressure, so a passing check is the finish line. | low · fast · light | `task`, `test-command` |
| [`heterogeneous-critic`](heterogeneous-critic.grooph.json) Heterogeneous critic | graph | The judge should not share the builder's model when isolating taste or blind spots matters: a same-model critic keeps approving the mistakes the builder makes. | medium · medium · high | `task`, `test-command`, `checklist` |
| [`human-gated-irreversible`](human-gated-irreversible.grooph.json) Human-gated irreversible step | fragment | A step cannot be undone (merge, spend, publish, delete) and must wait for a human decision; this fragment satisfies E_IRREVERSIBLE_NO_GATE. | low · fast · standard | `action`, `irreversible` |
| [`metric-sandwich`](metric-sandwich.grooph.json) Metric sandwich | graph | Cheap deterministic checks first, expensive judgment only on what those cannot see: lint and tests catch most failures, and a reviewer should not spend a round on them. | medium · medium · standard | `task`, `test-command`, `checklist` |
| [`ownership-not-swarm`](ownership-not-swarm.grooph.json) Ownership, not swarm | graph | Coupled subsystems get one owner; fan out only the independent pieces. The work spans a shared core and several leaf pieces that touch nothing else. | medium · medium · standard | `task`, `test-command`, `subsystem-a`, `subsystem-b` |
| [`red-team-loop`](red-team-loop.grooph.json) Red-team loop | graph | A separate attacker should produce failing traces and the builder should see only those: hardening against inputs or abuse nobody has listed yet. | medium · medium · high | `task`, `test-command`, `attack-surface` |
| [`retrospective-rewrite`](retrospective-rewrite.grooph.json) Retrospective rewrite | graph | After a run, propose graph edits rather than rewriting mid-flight: the graph is being tuned across runs and the human wants every change as a proposal. | low · medium · standard | `task`, `test-command` |
| [`review-gate`](review-gate.grooph.json) Review gate | graph | Work, then a separate reviewer, then iterate or pass: the change needs a second pair of eyes against a checklist that already exists. | medium · medium · standard | `task`, `test-command`, `checklist` |
| [`spec-then-loop`](spec-then-loop.grooph.json) Spec then loop | graph | No external reference product exists: a planning pass writes an answer key (ACCEPTANCE.md) that becomes the bar. The default for zero-to-one work. | medium · medium · high | `task`, `test-command` |
| [`specialist-critic-bank`](specialist-critic-bank.grooph.json) Specialist critic bank | graph | Multiple disjoint judges (correctness, security, performance, taste) should each look at the change, and their findings need merging by severity. | high · medium · high | `task`, `test-command` |
| [`taste-polish`](taste-polish.grooph.json) Taste polish | graph | Done and good have split: the artifact works but must match a named, inspectable reference, and the polish can be judged from captures. | high · slow · high | `task`, `reference`, `capture-command` |
| [`tournament-then-judge`](tournament-then-judge.grooph.json) Tournament then judge | graph | Cheap candidates, then spend the expensive critic on finalists: the approach is open, drafts are cheap, and comparing working options beats arguing about them. | medium · fast · standard | `task`, `test-command`, `criteria` |

_Generated by `scripts/patterns-index.mjs` from the documents in this folder, like `index.json`. Edit a pattern, then run `node scripts/patterns-index.mjs`; CI fails when either file is stale._

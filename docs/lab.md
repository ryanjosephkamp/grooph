# The lab (experimental)

grooph draws workflows; it does not direct a session. What did direct one is kept in the repository as the lab: the compilers that turn a diagram into a prompt package for Claude Code or Codex, stops a run is told to obey, run folders and the notes a run writes, taking a run's changed copy back as the next version of a diagram. The records of the [experiments](experiments.md) are kept beside it.

The lab is experimental. It builds and is tested with the rest of the repository, and it may change, or go, in a later version. The `grooph` command has none of its commands. Two ways to a package remain in what grooph ships, both marked Experimental: the MCP tool `grooph_export`, and the app's Export panel. The compilers they use are still in `packages/core`.

## Running it

From a clone, after `pnpm install && pnpm -r build`:

```bash
node lab/bin/grooph-lab.js --help
node lab/bin/grooph-lab.js export <graph> --target claude-code --into <project>
node lab/bin/grooph-lab.js runs list <project>
node lab/bin/grooph-lab.js adopt <project>/.grooph/<id>/runs/<run>
```

`grooph-lab` does everything `grooph` does, plus `export`, `adopt`, `runs`, and `watch` of a run folder. None of these calls a model.

## Where to read more

- [`lab/README.md`](../lab/README.md): what is in the lab, where each part lives, and how it is tested.
- [`docs/targets/claude-code.md`](targets/claude-code.md) and [`docs/targets/codex.md`](targets/codex.md): what a package holds for each harness.
- [`docs/runs.md`](runs.md): run folders, run notes, and adopting a run's copy.
- [`docs/comparisons.md`](comparisons.md): the protocol of the paired comparisons.

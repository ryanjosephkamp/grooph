# Experiments

**[`patterns/`](patterns/)**: the pattern proving ground (stage 6, slice 0009). One recorded headless Claude Code run per built-in template, on a small task designed so the pattern's point shows, with the evidence and a one-screen write-up. `scripts/prove-pattern.sh` makes the runs, and `patterns/ledger.json` records what each model call cost. Each proven template's `demo` points at its write-up.

**Paired harness runs** (stage 8, later): the same graph exported to each harness, run independently with comparable model pairings. Each experiment gets a folder with the graph, both packages, the run notes each harness produced, and a short write-up. If a one-shot deploy failed and few-shot was used, the write-up says why. The proving runner is meant to be reused for them.

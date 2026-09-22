# Experiments

**[`patterns/`](patterns/)**: the pattern proving ground (stage 6, slices 0009 and 0011). One recorded headless Claude Code run per built-in template, all sixteen proved, on a small task designed so the pattern's point shows, with the evidence and a one-screen write-up. `scripts/prove-pattern.sh` makes the runs, and `patterns/ledger.json` records what each model call cost. Each proven template's `demo` points at its write-up.

**[`comparisons/`](comparisons/)**: paired comparisons (stage 10a, slice 0016; protocol [`docs/comparisons.md`](../docs/comparisons.md)). Per template, one designed project run three ways under equal conditions — the package (arm A), a prompt derived from it by rule (arm B), the same prompt in a fresh-session loop (arm C) — scored by one script on a held-out suite, judged blind, and written up with the one required line: did the graph earn its cost. `scripts/compare.sh` makes the runs, and `comparisons/ledger.json` records every model call.

**Paired harness runs** (stage 8, later): the same graph exported to each harness, run independently with comparable model pairings. Each experiment gets a folder with the graph, both packages, the run notes each harness produced, and a short write-up. If a one-shot deploy failed and few-shot was used, the write-up says why. The proving runner is meant to be reused for them.

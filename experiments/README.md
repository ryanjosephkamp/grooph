# Experiments

**[`patterns/`](patterns/)**: the pattern proving ground (stage 6, slices 0009 and 0011). One recorded headless Claude Code run per built-in template, all sixteen proved, on a small task designed so the pattern's point shows, with the evidence and a one-screen write-up. `scripts/prove-pattern.sh` makes the runs, and `patterns/ledger.json` records what each model call cost. Each proven template's `demo` points at its write-up.

**[`comparisons/`](comparisons/)**: paired comparisons (stage 10a, slice 0016; protocol [`docs/comparisons.md`](../docs/comparisons.md)). Per template, one designed project run three ways under equal conditions — the package (arm A), a prompt derived from it by rule (arm B), the same prompt in a fresh-session loop (arm C) — scored by one script on a held-out suite, judged blind, and written up with the one required line: did the graph earn its cost. `scripts/compare.sh` makes the runs, and `comparisons/ledger.json` records every model call.

**[`hooks/`](hooks/)**: what the harnesses tell a hook, and the MCP server in a real session (slices 0027 and 0028). One folder per session that was run, in Claude Code and in Codex, with what the harness printed, what the hook wrote, and a ledger of session ids, costs and transcript checksums. `node experiments/hooks/check.mjs` checks the ledger against the transcripts on the machine that ran them.

**Paired harness runs** (stage 8, later): the same graph exported to each harness, run independently with comparable model pairings. Each experiment gets a folder with the graph, both packages, the run notes each harness produced, and a short write-up. If a one-shot deploy failed and few-shot was used, the write-up says why. The proving runner is meant to be reused for them.

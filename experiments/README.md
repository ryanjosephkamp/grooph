# Experiments

The records of the studies and checks behind what grooph says about itself. They are kept as they were made, with local paths, session ids, and email addresses replaced by placeholders and the raw harness output (transcripts and their digests) left out. A table or a number in the docs links to the record it comes from.

**[`patterns/`](patterns/)**: one recorded headless Claude Code run per built-in template, on a small task designed so the template's point shows, with the evidence and a one-screen write-up. `patterns/ledger.json` records what each model call cost, and each run's `check.json` is the result of the check made on its evidence. Each proven template's `demo` points at its write-up.

**[`comparisons/`](comparisons/)**: paired comparisons (protocol: [`docs/comparisons.md`](../docs/comparisons.md)). Per template, one designed project run three ways under equal conditions: the package (arm A), a prompt derived from it by rule (arm B), and the same prompt in a fresh-session loop (arm C). Each run is scored by one script on a held-out suite, judged blind, and written up with the one required line: did the graph earn its cost. `comparisons/ledger.json` records every model call.

**[`watching/`](watching/)**: the check of whether the event hook changes what a session does (36 runs), and the second look at it. `RESULTS.md` holds the tables, and `tables.mjs --check` rebuilds them from the records.

**[`hooks/`](hooks/)**: what the harnesses tell a hook, and the MCP server in a real session. One folder per session that was run, in Claude Code and in Codex, with what the harness printed, what the hook wrote, and a ledger of costs.

The runners that made these records start paid sessions and are not in the repository. A run was started by a person and recorded before its result was used.

The write-ups name some files that are not kept: each run's `transcript-digest.json` and `claude-output.json` (raw harness output), the compiled package folders, and the auditors' probe scripts. The numbers in the write-ups were read from those files when they were made.

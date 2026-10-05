# 0076 · Proposed review-gate proving invocation

**Status: proposed, not invoked.** The owner asked for the fix pass without a model session. After the driver's fresh review of the fixed head, the owner may authorize this one invocation and its transcript receipt.

Run this exact command against the built slice checkout:

```sh
node /Users/noir/Documents/grooph-codex/scripts/prove-codex.mjs --run
```

The runner starts one `codex` process in a fresh task project. Its argument vector is `exec --json --sandbox workspace-write --model gpt-6.1-sol`, followed by these invocation-scoped settings and the complete text of the generated `.grooph/truncate/KICKOFF.md` as the final argument:

```text
-c web_search="disabled"
-c model_reasoning_effort=high
-c agents.default_subagent_model=gpt-6-luna
-c agents.max_concurrent_threads_per_session=2
```

The lead is Sol/high; the two custom worker definitions resolve to Luna from the committed profile, without `--models` or `GROOPH_MODELS` overrides. There is a 15-minute process timeout and a two-worker concurrency setting. The graph's own stops remain unchanged. Tokens are recorded as reported; USD remains unknown unless actually reported. There is no dollar-cap promise.

## Reads and writes outside this repository

| Place | Reads | Writes |
|---|---|---|
| Installed tools | The installed `codex` binary/version, Node, Git and npm; normal inherited environment and tool configuration | Normal tool cache/log state if those tools create it |
| `$TMPDIR/grooph-prove-codex-review-gate-*` | A copy of the existing proving task and its exported graph/package | A new scratch Git project, `.grooph/truncate/`, `.codex/agents/`, task edits, `REVIEW.md`, tests and run notes; the folder is kept |
| System temporary directory, `grooph-prove-codex-grooph-home-*` | Built-in template data through the local grooph CLI | Temporary grooph registry/cache state; this `GROOPH_HOME` is inherited by the Codex process |
| Configured Codex home, normally `/Users/noir/.codex` (or existing `CODEX_HOME`) and configured owner resources | Codex's normal authentication, user configuration, trust, hooks, instruction/skill discovery and configured integrations; authentication may use the keychain | Normal native session, rollout, log, cache and database state, including the workers the lead dispatches |
| Model service / configured integrations | Authenticated model requests and any configured tools the session is permitted to use | Model usage/spend and any permitted tool effects; disabling web search does not disable other integrations |

The runner does not relocate `CODEX_HOME`, change saved configuration or trust, install hooks/skills, or bypass owner approval. The command names no approval option, and which approval policy then applies to the lead and the workers is unknown until this run shows it (corrected 2026-10-05: this page said they inherit the owner's policy, which nobody had checked). An unattended approval refusal returns a failure to the model; graph gates and stops remain instructions, not a native halt guarantee. If trust or custom-role availability prevents dispatch, retain that failure rather than changing the owner's settings.

Inside the repository, the runner creates `experiments/patterns-codex/review-gate/run/`: a ledger opened before launch, streaming stdout/stderr, prompt, package and agent definitions, task diff/tests, notes, result, session id and reported usage. It refuses an existing `run/`; a failed run is kept as evidence.

## Separate receipt after the invocation

The command does **not** open native transcripts. The proposed authorization also covers identifying only this invocation's actual native transcript and reading it to compute SHA-256, then adding its path/checksum to this run's ledger/result as decision 0015 requires. No prior session transcript is in scope. Keep an original containing account details on the machine; do not commit it. The concrete path is unknown until Codex starts the session.

The later checker is a repository-only command:

```sh
node /Users/noir/Documents/grooph-codex/scripts/prove-codex.mjs --check /Users/noir/Documents/grooph-codex/experiments/patterns-codex/review-gate/run
```

Report what occurred even when this checker fails. It checks retained dispatch, notes, halt, task-test, source-hash and usage evidence; it does not establish every native control, worker context exclusion or gate resume.

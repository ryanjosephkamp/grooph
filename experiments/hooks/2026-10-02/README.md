# 2026-10-02: many sessions, one events branch

No model session was started for this. It answers a question the Operator asked after its trial of the turn-end push: is one shared events branch safe when about ten sessions push at their turn ends, and does a refused push go again on the new tip?

[`../shared-branch.mjs`](../shared-branch.mjs) makes N small repositories, gives each one event file of its own, and runs `grooph-events-push.mjs --hook` in all of them at the same instant, as a harness would at a turn's end (with the script's own settling wait set to 0, so the collision is as hard as it can be). It then reads the branch and each repository's `.grooph/events/.last-push.json`.

```bash
node experiments/hooks/shared-branch.mjs --sessions 10                      # a remote on this machine
node experiments/hooks/shared-branch.mjs --sessions 10 --latency 2000       # the same, 2 s for a fetch and a push
node experiments/hooks/shared-branch.mjs --sessions 10 --remote <url> --branch <name>    # a real remote: it writes that one branch and leaves it
```

| File | Remote | Sessions | Arrived | The last one | Tries, per session |
|---|---|---|---|---|---|
| [`shared-github.json`](shared-github.json) | GitHub: this repository, branch `grooph-events/trial-0048-shared`, deleted afterwards | 10 | 10 | 25.0 s | 1 to 10, one each |
| [`shared-local.json`](shared-local.json) | a bare repository on the Mac | 10 | 10 | 3.8 s | 1 to 8 |
| [`shared-local-26.json`](shared-local-26.json) | the same | 26 | 26 | 12.4 s | 1 to 18 |
| [`shared-local-slow.json`](shared-local-slow.json) | the same, 0.8 s before a fetch answers and 1.2 s inside each push | 10 | 10 | 26.0 s | 1 to 10, one each |
| [`shared-local-too-slow.json`](shared-local-too-slow.json) | the same, 2 s and 3 s: more than fits in the hook's 45 s | 12 | 8 | 45.2 s | 1 to 8; the other four recorded `no time left after 8 tries: other sessions kept sending to grooph-events/trial-shared first` |

In every run each process printed nothing and exited 0, the branch held one commit per session that arrived, each on top of the one before, and every arrived session's file was whole.

**What it shows.** The remote takes one push at a time and only on top of what it holds, so one session gets through each round and the rest look again. A round on GitHub took about 2.5 s. The hook has 45 s, so about sixteen sessions ending in one instant is the ceiling by that arithmetic; sixteen itself was not tried.

**What it found that nobody asked.** The first GitHub attempt, at 21:54 UTC, arrived nowhere: all ten were refused with `push declined due to email privacy restrictions`. The trial repositories had no identity of their own, so the commits carried this Mac's global git e-mail address, which the owner keeps private on GitHub. Nothing reached the remote. Each of the ten recorded the refusal in its `.last-push.json`, which is how it was seen. An events commit is now made as `grooph <grooph@localhost>` whatever the session's git identity is. A second attempt with that change arrived whole (ten of ten, the last after 23.9 s). The files here are from a later run of each, between 23:03 and 23:06 UTC, made after two independent reads of the change and their fixes, so that the record is of the code proposed for merging. Two runs in between, with the code as it stood after the first read, gave the same picture (GitHub: ten of ten, the last after 24.6 s). No CI run started for the events branch: it holds no workflow file.

The output of the first attempt was not kept as a file; its ten failure lines were the same sentence. Nor was the second's: the third run's files replaced it.

## Game experiment: can the Claude Code run start tonight?

Made on 2026-10-11 by a read-only reader for the driver, against `main` at `1f3bd618`. Nothing was started, pushed or changed. It is the reader's report as given. Since it was written the driver confirmed two of its points by the hashes: `446bcf60`, the last commit before the hook's fix, holds the setup scripts and the frozen hook's bytes; `4a6f91d7`, the commit the script's remedy names, does not hold the scripts.

**Verdict: not ready as written.** `origin/main` moved while I was checking: PR #190 (the hook's link fix) merged at 13:37 EDT. On today's `main` (`1f3bd618`) `make-repo.sh` stops at the frozen manifest, and the remedy it prints cannot be followed. Ready tonight once item 5.1 is decided and 5.2 to 5.4 are handled.

(S = I ran or read it; R = reasoned.)

### 1. What exists on this Mac
- `~/grooph-game/` and `~/grooph-game-kept/` do not exist (S). Parts 1 to 3 have never been done: no profile, no sign-in, no rehearsal folder, no game folder, no worktree at the freeze.
- No record: `experiments/game/runs/` holds only `.gitignore` and `README.md` in this worktree and in the main clone (listed by name), no `ledger.json`, and nothing was ever committed on any branch (S).
- Playwright, by `ls ~/Library/Caches/ms-playwright` (S): `chromium-1200/1223/1228/1234` and `chromium_headless_shell-1243`. The repo's pinned Playwright 1.63.0 wants revision 1243 (S, its `browsers.json`); the windowed `chromium-1243` is not there. npm's `latest` is now 1.64.0, published 2026-10-07 (S); no browser folder is newer than 1243. Both install lines will download.
- The GitHub repository already exists: public, one "Initial commit", a 31-byte README, `main` unprotected, no rulesets (S). He does not need to make one.

### 2. The runbook, step by step

| Step | What he meets today | |
|---|---|---|
| 1 `git status -sb` | `## main...origin/main [behind 6]` (main clone at `47ace71f`). Whether files are listed under it: not checked, by your rule | S / not checked |
| 1 pull, `pnpm install`, `ls` | fast-forward to `1f3bd618`; lockfile unchanged since `47ace71f` (S); the two names | R |
| 1 `shasum -c frozen.sha256` | fourteen `OK`, exit 0 | S |
| 1 `npm view playwright version` + install | prints 1.64.0, not the runbook's 1.63.0; a download. Which revision 1.64.0 wants: could not tell | S / R |
| 1 `pnpm --filter @grooph/web exec playwright install chromium` | one more download (windowed 1243) | S |
| 2 `make-profile.sh` | four lines; temp folder is under `/var/folders` (S) | R |
| 2 `start-claude.sh sign-in` | pre-checks pass: `claude` 2.1.289 (the version `PROFILE.md` was written against), `xcrun -f git` found, `grooph` off the session path, node/npm/git on it, no managed settings (all S). The command's flags have never been executed by anyone | S / R |
| 3 `make-repo.sh --rehearsal` | **stops** (below) | S |
| 3 `start-claude.sh rehearsal` | port 4361 closed, nothing of `acceptance/` running, no `CLAUDE.md` above, no earlier `setup.txt` (S); passes once the folder has a commit | R |
| 3 `record.sh`, `clear-rehearsal.sh`; 6 `score.mjs` | unchanged since 2026-10-04 22:19 (S) | R |
| 4 `make-repo.sh` + two push lines | same stop; the force push itself is unobstructed | S / R |
| 5 `start-claude.sh run` | adds: rehearsal cleared, clean tree, one commit | R |

**`make-repo.sh` on today's main.** I did not run it: it builds inside the checkout (`pnpm … build` writes `dist/`) and on a match runs `git init`. I repeated its lines 73 to 89 into scratch with the compiler already built here (`adadaf13`, byte-identical under `packages/` to `origin/main`). 17 files; 16 match the manifest; one differs. He will see:

```
13c13
< c28e9b2e85c2e63c2c4c9c401f076647378e9cd71d24a25a5fb5f7e181f5e45c  .grooph/hooks/grooph-event.mjs
---
> 836cb61ef31dc6f02bec6a846bc72fbab60df3eea76dd02e619105155cb5a08f  .grooph/hooks/grooph-event.mjs
make-repo: what was built is not what was frozen (/Users/noir/Documents/grooph/experiments/game/setup/starting-contents.claude-code.sha256): the lines above are the difference.
The compiler here is grooph's packages at adadaf132fb60dfb5a813038627025278607924a; the freeze was compiled at 4a6f91d7dc9a3e2fbdaab4f284d69a5872a30d81.
If packages/ has changed since, build from that commit instead:
  git -C "/Users/noir/Documents/grooph" worktree add --detach "/Users/noir/grooph-game/grooph-at-the-freeze" 4a6f91d7dc9a3e2fbdaab4f284d69a5872a30d81
and run its experiments/game/setup/make-repo.sh. The folder /Users/noir/grooph-game/rehearsal-claude was made and is left for you to look at.
```

**The remedy is not workable (S).** `4a6f91d7` has no `experiments/game/setup/` at all, and neither does the frozen commit `11070a7`; `make-repo.sh` first appears in `76b06b6b`, after both. Its dependencies would be fine: the lockfile there differs from today's by one importer entry (`rolldown`), same pnpm 11.7.0 (S), so it should install from the store (R; store not inspected).

**What does work (R, from seen parts):** the main clone is still at `47ace71f`, where the last `packages/` commit is `2f85a6a2` and the hook is the frozen `c28e9b2e`. Unpulled, it builds the frozen 17 files. So does a worktree at `446bcf60` after `pnpm install`.

Models (`claude-opus-5-5`, `claude-sonnet-5-5`) and `--models` are accepted by today's export (S). Any start before 4:45 a.m. Monday reaches its wall before the reset.

### 3. By hand, in order
Runbook's own times in quotes; the rest are my estimates.
1. Part 1: ~10 min plus two downloads ("about 150 MB" each). **Can be done now.**
2. Part 2: ~10 min, no model call. **Can be done now.**
3. Part 3: gate "within a minute or two", then "twenty minutes", record "a minute or two"; ~35 min, then your reading. Scoring the rehearsal adds "a few minutes for each commit" plus "about a quarter of an hour". **Waits on 5.1.**
4. Part 4: ~3 min, on his word.
5. Start: ~5 min, "start" answered "within a minute". Then "six hours at most", wall at 6 h 15 min. He must be reachable for limit lines and at the wall: an 8 p.m. start means 2:15 a.m.
6. Close: ~10 min. Part 6: 20 to 30 min or more, Mac left alone; can be Monday.

**Total: about 1.5 hours of his attention before the start, up to 6 h 15 min of run, about 40 min after.**

### 4. A usage limit
`PROTOCOL.md` §2 and §10, `RUNBOOK.md` 239 to 261: the clock goes on. A five-hour limit: the session waits and continues by itself; he writes both times and types nothing. If it has not moved five minutes after the reset, or asks for a key: Return once, then the one line; logged as an interruption. A weekly limit, or three stops running: the run ends where it stands, left open until the wall; the result is the last commit that builds. Never another account, model or credit.

This account at 13:50 EDT (S, app's usage tool): five-hour 7% used, resets 3:50 p.m.; **weekly 62% used**, resets Monday 10:59:59 a.m. EDT; extra usage off. Tonight a weekly hit is final. Whether 38% covers rehearsal, run and tonight's lanes: could not tell; nothing this size is on record.

### 5. To decide or fix, most serious first
1. **Which hook the run records with.** `make-repo.sh:92-98`; manifest line 13. Frozen hook: by `docs/releases.md` it "appended its line through whatever stood there", it runs outside the sandbox (`PROFILE.md:72`), and the profile write-denies only `.grooph/hooks`, not `.grooph/events` (`setup/profile/settings.json:32`). Fixed hook: new manifest and tree, so `FROZEN.md:41`, `RUNBOOK.md:123` and `:196` change, and Codex must get the same (`RUNBOOK.md:3`, `PROTOCOL.md:21`). Handback 0085 line 275 had promised the hook scripts would not be edited before both first commits.
2. **The printed remedy** (`make-repo.sh:97-98`) names a commit without the script, and would put a full checkout holding `acceptance/` inside `~/grooph-game`, beside the session's folder. After the stop the leftover folder makes a second `make-repo.sh` refuse (`:58`) and `start-claude.sh:64` say "is not there". If the frozen hook is kept: nobody pulls the main clone until both `make-repo.sh` calls are done, which contradicts `RUNBOOK.md:20`.
3. **`handoffs/0103-the-lab/HANDOFF.md:26`** says the refusal's "own text says how the experiment is built from the freeze". It does not. The lab's later pull requests may move `export` (`make-repo.sh:71-77`): make both commits first.
4. **Tonight's lanes** spend the same allowance (`RUNBOOK.md:261`) and serve pages on a `localhost` the session can reach (`RUNBOOK.md:200`, `PROFILE.md:85`). Listening now (S): Ollama on 11434 and 49385, a local model a session's commands could call; Python on 8742.
5. **Stale lines:** `RUNBOOK.md:37` (1.63.0), `:14-17` (`[behind 6]`), `:11`; `docs/PROGRESS.md:84` (allowance "reset on 2026-10-05").
6. **How the record reaches the repository:** `record.sh` and `clear-rehearsal.sh` end with "commit experiments/game/runs", in a clone nobody commits in (`handoffs/DRIVER.md:24`).
7. **Decision 0032:** everything the run needs still exists and works on `main` (S: export and `hooks install` exit 0). `PROTOCOL.md:97` leans on decision 0013 as "already shown", whose fifth point 0032 replaced (`0032:82`); `spec/contract.md:12` says grooph never directs a session. A dated note in §10 that this is a lab run is due.

Disclosures: I checked whether `~/.claude/CLAUDE.md` exists (it does not; nothing read), as `start-claude.sh` does. Scratch output is in `…/scratchpad/game-ready/`. No session started, nothing pushed, worktree still clean.

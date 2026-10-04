# The driver's seat

For the session that drives grooph next. The driver's memory is this file, `docs/PROGRESS.md`, the review desk, and the memory folder the harness loads (`~/.claude/projects/-Users-noir-Documents-grooph/memory/`). A session that has grown long hands the seat over by bringing this file up to date and saying so to the owner; the owner opens a fresh session in this folder and tells it to read this file.

**Last brought up to date:** 2026-10-04, by the session titled "grooph opus operator".

## Who you are

The driver (`AGENTS.md`, "Roles"): an Opus 5.5 session in `/Users/noir/Documents/grooph`. You plan, write handoffs, run the lanes and the review desk, review handbacks and pull requests, merge what decision 0023 allows, and keep `docs/` current. You build small things yourself and hand slices to lanes.

The owner is Ryan. He often speaks his prompts and reads on a phone. He wants results he can look at, honest accounts of what went wrong, and few questions: put decisions on the desk with a recommendation, and go on with everything that does not depend on the answer.

## At the start of every turn

1. **Read the desk's answers.** `ArtifactData` (load it with ToolSearch), `action: "list"`, collections `answers` and `notes`, with the desk's address from `handoffs/briefs/README.md`. An answer is the owner's word. Mark what you have acted on: update the item in `queue` (`status: "settled"`, `driverNote`).
2. **Read the lanes.** `mcp__ccd_session_mgmt__list_sessions` finds them (sessions in this folder or its worktrees); `list_events` reads a lane's recent turns; `SendMessage` with its `local_…` id answers it. Keep each lane's row in the desk's `lanes` collection current.
3. **Read the pull requests.** `gh pr list`, then every job of each one's checks, line by line. Merge what decision 0023 allows and log it in the desk's `merges` collection; put the rest in `queue`.
4. **Then the work.**

## The rules that bite

- **Never Fable. Never Astra.** Local sessions. Opus 5.5 by default, Sonnet 5.5 for checklists. In Codex: GPT-6.1 Sol leads, GPT-6 Luna works. The Claude Code target maps the `frontier` tier to Fable: any run of the owner's exports with a tier map that does not (slice 0079).
- **Touch only this repository**, and `/Users/noir/Documents/grooph-exchange/`. The owner has other projects on this Mac and their sessions appear in the session list: never message them, never open their folders. Port 4173 belongs to one of them; browser tests use `GROOPH_E2E_PORT`.
- **The public repository does not name his other private projects.** The sample map names what he has confirmed.
- **Merging**: decision 0023. Merge commits. Watch CI on `main` after each. "Green" is every job on the head, read line by line.
- **Claims** go through the audit loop before they are published (decision 0024). The ceiling until then is decision 0013's wording.
- **A run is recorded before its result is used** (decision 0015). No model session by command without a ledger row.
- **American English** in everything public; `node scripts/american-english.mjs --check`.
- **Files are added by name.** A pushed branch is never rewritten.
- **A page is published only from a file the repository keeps** (`handoffs/briefs/`), and its address is recorded there.
- **Time a page with the browser's clock** (`scripts/perf-loadtime.mjs`), and keep `node scripts/perf-budget.mjs --check` green: the owner's standing condition is that nothing costs speed.

## Tools worth knowing

- **Sessions**: `mcp__ccd_session_mgmt__list_sessions`, `list_events`, `get_usage` (the plan's limits and this session's context), and `SendMessage`. You cannot start a session; the owner does, in the app.
- **The desk's data**: `ArtifactData` with the desk's address. Collections: `queue` (what waits on the owner), `answers` (his, keyed by the queue item's id or an idea's id), `notes` (anything he typed), `lanes`, `merges`, and the document `meta/desk`.
- **The built-in browser** checks the live site. Playwright (`apps/web/node_modules/@playwright/test`) takes pictures.
- **Pull requests**: `gh`. After opening one, `mcp__ccd_pr__get_status`.
- **Codex** by command, for a small check only: `/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex exec … < /dev/null`. An audit or a slice goes to a Codex session the owner opens.

## Where things stand

`docs/PROGRESS.md` is the state. In one paragraph, as of the date above: 0.3.0 is merged, tagged and live. Public text is American English, with a check in CI. The driver may merge small, safe pull requests (decision 0023). The second push is set up as lanes: the audit lane (0075), the Codex target in Codex (0076), the site in the owner's style (0077), agents and chat (0078), and comparison study two (0019), each waiting for the owner to start it. The review desk holds his decisions on those and on what comes after: nested and linked graphs, other views and themes, a desktop app, the game experiment in both harnesses.

## Handing the seat over

Bring this file's date and "Where things stand" up to date, make sure `docs/PROGRESS.md` and the desk agree with the repository, commit, and tell the owner in one line: "open a new session in the grooph folder and say: you are the driver; read handoffs/DRIVER.md." Do it when the context is past about two thirds, at a moment when no merge is half done.

# Handback 0078 · grooph for agents: authoring over MCP, a package on npm, and a way in from a chat

**Implementer:** Opus 5.5 (the agents lane) · **Branch:** `slice/0078-agents-and-chat` · **Head commit:** `222b753` (the work, after the driver's two fix passes and with `main` merged in at `89fc884`; the handback commit follows it) · **Date:** 2026-10-04

## Status

`done` — every criterion is met as far as this lane may go: the tools, the package and the paste path are built and tested; each chat surface was tried through a stand-in and none in the vendor's own app, which needs the owner's accounts. Three things wait for the owner: the npm publish, a test in each chat app (prompts below), and whether to build a hosted endpoint.

**Read this first, before merging.** The pages this pull request adds tell people to run `npx -y grooph …`, and the name `grooph` is not on npm yet. If the pages go live before the package does, anyone could register the name and those commands would run their code. Publish first, or in the same sitting as the merge (the three commands are below).

## What changed

**The MCP server** (`packages/cli`)
- `src/mcp-author.ts` (new): nine tools, `grooph_templates`, `grooph_use_template`, `grooph_new`, `grooph_apply`, `grooph_explain`, `grooph_shape`, `grooph_share`, `grooph_picture`, `grooph_export`. Documents go in and come back as JSON; `path` reads a file, `out` or `into` writes one.
- `src/mcp.ts`: `grooph_validate` also takes the document itself; `handle` is asynchronous; replies leave in order; `grooph mcp --chat` offers the ten authoring tools only and writes nothing; each tool carries a title and the protocol's read-only and destructive hints.
- `src/fixes.ts` (new): one line per rule code saying what to do, typed so a new rule does not build without one.
- `src/paths.ts` (new): where the CLI's own files are, in a clone, an npm install and a single bundled file. `registry.ts`, `commands/hooks.ts`, `commands/watch.ts` use it.
- `src/main.ts` (new), `bin/grooph.js`: one entry; a closed pipe (`grooph template list | head`) ends quietly.
- `src/index.ts`: the `mcp` command's `--chat` flag, the no-folder guard, its help page. `commands/explain.ts`, `embed.ts`, `image.ts`: small exports the tools reuse; CLI output unchanged.
- Tests: `test/mcp-author.test.ts` (new, 27 tests), `test/agents-page.test.ts` (new, 4), `test/mcp.test.ts` (updated, one added). CLI total 152.
- `src/share-io.ts`: a proposal set's candidate files, for the server, only as graphs beside the set; a file that is not JSON is no longer quoted in the error (the CLI's too).
- `docs/cli.md` regenerated for the `mcp` command's new help page, as the driver asked once `main` began checking it.

**The package** (`packages/cli`, `scripts/`)
- `scripts/bundle.mjs`, `npm-package.mjs`, `chat-kit.mjs`, `zip.mjs` (all new), `README.md` (new, the npm page), `package.json` (rolldown as a development dependency; `package` and `kit` scripts), `pnpm-lock.yaml` (three lines: rolldown was already resolved through vite).
- `scripts/pack-check.sh`, `scripts/kit-check.sh` (new), `.github/workflows/ci.yml` (two steps and an artifact).

**From a chat**
- `plugins/grooph-chat/` (new): the skill for claude.ai (`SKILL.md`, `README.md`). The zip and the desktop extension are built, not committed.
- `plugins/grooph/`: the design skill uses the tools when it has them; `.mcp.json` (new) starts the server; plugin version 0.2.0.
- `apps/web/src/ui/Library.tsx`, `apps/web/src/store/library.ts`: **Paste a document**. `apps/web/test/paste.test.ts` (9 tests), `apps/web/e2e/paste.spec.ts` (4) (new).

**Pages**
- `docs/agents.md`, `docs/chat.md` (new), `docs/quickstart.md`, `apps/web/public/llms.txt` (new), two entries in `scripts/site/pages.json`.

**The record**
- `handoffs/0078-agents-and-chat/runs/`: six recorded model sessions, their ledger and the scripts that made the records. `DECISION-hosted-endpoint.md`: the endpoint, written up for the owner.

## Verified, and how

Run from a clean build at `222b753`: both fix passes, and `main` merged in at `89fc884`, which has the frontmatter fix (#63), the site's new look (#58), the map views (#65) and the budget compared to the byte with the canvas line at 280 KB.

```text
pnpm -r build && pnpm -r test          core 363 pass · cli 152 pass · web 68 pass
scripts/pack-check.sh                  pack check: ok (grooph-0.3.0.tgz, 772 KB, 77 files; installed and run in a fresh folder)
scripts/kit-check.sh                   kit check: ok (grooph-chat.zip 241 KB, grooph.mcpb 240 KB; …run with nothing installed beside them)
scripts/first-run.sh                   first run: ok
GROOPH_E2E_PORT=4362 pnpm --filter @grooph/web test:e2e      210 passed, 125 skipped, none failed
node scripts/american-english.mjs --check      nothing British in 577 public-facing files
node scripts/site-pages.mjs --check    23 pages and an index, links and anchors resolve
version · cli-reference · check-pictures · check-outside-addresses (--check)      all current; nothing is loaded from another host
patterns-index · field-guide · rule-reference · community-index (--check), check-brake-values, test-install-local.sh      all pass
export of review-loop and fix-until-green                    the same as the golden packages
a line break in a pin, and in a skill name, through grooph_export (with into, and returned)      each refused by E_SCHEMA; nothing written
```

`node scripts/perf-budget.mjs --check`, every line inside:

```text
ok     179.33 of   180  the app's first load (HTML, scripts and styles), gzip KB
ok     157.94 of   162    of which scripts
ok      19.91 of    20    of which styles
ok      40.69 of    42  the fonts a first visit to the front page fetches, KB as sent
ok     221.35 of   224  a first visit to the front page in all (first load, fonts, icons), KB
ok     277.24 of   280  the first load of an address that draws on the canvas, gzip KB
ok     126.06 of   132  an embed's first load, gzip KB
ok      97.15 of   400  the CLI's cold start, ms (middle of five)
```

The paste reader is 1,239 bytes gzip of the scripts, in the app's own script, and adds no stylesheet: it is laid out with classes the app already has, and this branch does not touch `styles.css` (the styles line is `main`'s own 19.91).

`(cd packages/cli && npm pack --dry-run)` from the handoff is answered under Deviations.

Per criterion:

1. **Authoring tools.** `packages/cli/test/mcp-author.test.ts`: an agent path with no file (template → fill → apply → validate → explain → shape → picture → share → export, the link decoded back to the same graph); new + apply rebuilds `fixtures/valid/review-loop.grooph.json` byte for byte; the failing operation is named by index; every refusal ends in `next:` and names the rule's code where a rule refused; nothing is written outside the project (climbing, absolute, through a link, through a dangling link), and nothing at all when the server was given no folder. `docs/agents.md` is on the site and held to the code by `test/agents-page.test.ts`. `llms.txt` is served from the site's root (`apps/web/public/`).
2. **The package.** `scripts/pack-check.sh`: assembled, `npm pack`, installed from the tarball into a temporary folder that is not a clone, then `npx grooph --version`, the templates offline, the quickstart's path, a PNG, `hooks install`, the MCP server (13 tools; 10 with `--chat`) and the app `watch` serves. In CI on Node 22 and 24.
3. **From a chat.** `docs/chat.md` and the section below.
4. **The design skill.** Runs E (CLI alone) and F (with the tools), below.
5. **Still green.** The block above.

## One agent building a graph with the tools alone

[`runs/2026-10-04/b-tools-only-after/transcript.md`](runs/2026-10-04/b-tools-only-after/transcript.md): a `claude-sonnet-5-5` session with no built-in tool, no skill and no shell, only the ten tools, served by the server inside the desktop extension. Six calls, 26.3 s, $0.1430:

```text
grooph_templates      {}
grooph_use_template   { id: "grind-loop", name: "Fix flaky checkout test", values: { task: "…", "test-command": "pnpm test checkout" } }
grooph_apply          { graph: "fix-flaky-checkout-test", ops: [{ op: "updateNode", id: "builder", set: { brief: "…" } }], forExport: true }
grooph_picture        { graph: "fix-flaky-checkout-test" }
grooph_explain        { graph: "fix-flaky-checkout-test" }
grooph_share          { graph: "fix-flaky-checkout-test" }
```

It gave the person the link, the bounds (five rounds or thirty minutes, then it halts and reports), and said it had not invented a repeat-run command. The link was opened in the published app and showed the graph, read-only, with Save to this device.

Run A is the same session before three fixes it prompted, and is kept because it is why they exist: Claude Code hands the model a tool's structured data and drops its text, so no `next:` or `fix` line reached it; the model resent the whole document on every call and one call failed to parse; it guessed `field` for `setGraphField`'s `key`. Now the lines travel in the data too, a call may name a graph by its id, and `grooph_apply`'s description lists every operation's arguments. One run each: B's smaller numbers are what happened once, not a measured effect.

## Each chat surface

All six sessions and their costs are in [`runs/README.md`](runs/README.md). Total **$1.0287** as Claude Code reported it, all on `claude-sonnet-5-5`. Runs E and F are the design skill: E did every step with the `grooph` command and no tools; F, with the server attached, used `grooph_templates`, `grooph_use_template`, `grooph_validate` and `grooph_share`.

| Surface | Tried | Saw | Could not try |
|---|---|---|---|
| **Claude's desktop app** | The extension `grooph.mcpb` built; its manifest checked against the bundle format's 0.3 schema; its server started exactly as the manifest starts it, from `/`, driven by Claude Code with no other tool (runs A, B) | A validated graph and a working link in six calls; the server refuses to write there | The app itself. Adding a config entry or an extension changes your app, and the config route restarts it while every session, this one included, runs inside it |
| **claude.ai** | The skill zip built; unzipped into an empty folder with a shell that may run only `node`, `ls`, `cat`, and `grooph` off the `PATH` (run C) | The graph, the link, the SVG and the `.grooph.json` file, all from the skill's one script | Uploading it: your account. Whether claude.ai's sandbox Node is new enough is unknown; Anthropic's own skills run Node there |
| **ChatGPT** | Nothing in ChatGPT. Its documents were read: remote MCP servers only; the code tool is Python with no network | (with a Claude model) a document written from the page alone validates with no issues and the app's paste reader takes the reply whole (run D) | Everything in ChatGPT itself |
| **The app's paste** | Unit tests (9) and browser tests (4) on port 4362 | A document alone, in a fence, in prose, after other JSON, cut short; a link; a refusal that keeps the text | — |

**Prompts for you.** The same request everywhere:

```text
I have a flaky checkout test in my web shop's repo. I want an agent to keep fixing the code until `pnpm test checkout` passes, but it must not run forever and it must not weaken the test to get a pass. Use grooph to make me a graph for that. Show me the picture and give me the link so I can open it on my phone.
```

- **Desktop app:** download `grooph-kit` from this pull request's CI run (Artifacts), double-click `grooph.mcpb`, open a new chat, paste the request. Expect an approval prompt per tool, then a link and a picture.
- **claude.ai:** Settings, Capabilities, "Code execution and file creation" on; Customize, Skills, +, Create skill, Upload a skill, `grooph-chat.zip`; new chat; paste the request.
- **ChatGPT:** paste this, then the request, then put the reply into the app with **Paste a document**:

```text
Read https://ryanjosephkamp.github.io/grooph/docs/agents/ and follow it. You have no grooph tools here, so write the graph document yourself and give it to me in one json code block.
```

(That address exists once this is merged; before then, paste the text of `docs/agents.md` in its place.)

## The tarball

`grooph-0.3.0.tgz`: **790,535 bytes packed (772 KB), 2,198,577 unpacked, 77 files.** It grew from about 635 KB when `main`'s new look arrived: the app `watch` serves now carries its fonts.

| In it | Files | Size |
|---|---|---|
| `dist/bundle/grooph.js`, the command: the CLI and core as one file | 1 | 601 KB |
| `dist/patterns/`, the templates and their index | 21 | 151 KB |
| `dist/patterns/glyphs/` | 20 | 38 KB |
| `dist/app/`, the built app `watch` serves (fonts included), without source maps or the site's pages | 30 | 1,297 KB |
| `hooks/`, the event hook and the push script | 2 | 56 KB |
| `README.md`, `LICENSE`, `package.json` | 3 | 5 KB |

No dependencies, and one optional one: `@resvg/resvg-js`, for PNG, which has no install script (it brings the one prebuilt binary for the platform). Without it the SVG still works and the error says so. rolldown, the bundler, is a development dependency and is not in the tarball.

## The three commands that publish

```bash
npm login
pnpm install --frozen-lockfile && pnpm -r build && scripts/pack-check.sh
npm publish packages/cli/dist/npm
```

The second builds, assembles `packages/cli/dist/npm` and proves the tarball installs and runs; the third publishes that folder as `grooph`. The version is `packages/cli/package.json`'s, 0.3.0 today: if the driver cuts a release for this slice first, publish after the bump. To hold the name with no gap, publish 0.3.0 from this branch now and the release when it is tagged.

## Decisions made

- **The workspace package stays `@grooph/cli` and private; what is published is assembled in `dist/npm`.** The workspace root is itself named `grooph` and depends on `@grooph/cli` by name, and a published package cannot depend on `workspace:*`. Renaming would have meant changing the root manifest, which is not this lane's.
- **Bundler: rolldown.** Already in the lockfile through vite, so nothing new is downloaded. The PNG renderer stays outside the bundle as an optional dependency.
- **The package holds the app.** 1.1 MB unpacked without source maps; `watch` keeps its promise of asking the network for nothing.
- **PNG through the existing optional renderer; SVG always.** `grooph_picture` returns SVG text and, with `png: true`, an image block.
- **The chat skill is the whole CLI as one script**, with the templates beside it: one vocabulary in the docs, the tools and the skill. The zip and the `.mcpb` are built, not committed, so they cannot fall behind; CI builds and runs both and keeps them as an artifact.
- **A call may name a graph by its id.** The server remembers the graphs its tools return, in memory, until it restarts. Documents still travel as JSON in and out, as decided; this only spares sending one back. From run A.
- **A tool's lines are also in its structured data** (`text`), because Claude Code shows the model the data. From run A.
- **Templates for the tools are local only** (project, user, built-in): no tool reaches the network.
- **A server started in a folder nobody chose writes nothing**: the file system's root or a home folder, with no `--dir` and no `CLAUDE_PROJECT_DIR`. A desktop app may start a server in `/`.
- **A file already there is replaced only when it is grooph's own**: the graph the call read, an SVG that carries the picture's mark, or a package's files as grooph last wrote them. The last is asked of the package itself: it keeps the graph it was compiled from and states its tiers in `MAPPING.md`, so an existing file is grooph's when it is what that graph compiles to. Anything else stops the call, and `replace: true` forces it. (The driver's review, D.)
- **A graph is saved only as `<name>.grooph.json`, and nothing is written under `.git`.** (C.)
- **In a chat a tool takes no file argument**: `path` is refused before the disk is touched, and the library is the one grooph ships. (E.)
- **Only `--dir` can choose the root or a home folder as the project**; a harness's variable pointing there does not. (F.)
- **`grooph_export` takes `models`**, the tier map that landed on `main` as pull request 43 while this slice was open, laid over `GROOPH_MODELS` from the server's environment (read through the CLI's own parser), and says in every reply what all three tiers mean. It holds a model's name to the CLI's own pattern (a name goes into a file's frontmatter) and prints the CLI's own line saying what all three tiers then mean.
- **A file is put by writing beside it and renaming over it, and never through a link.** From the independent review: a hard link to a file elsewhere keeps what it had, and a link inside the project is not followed.
- **`grooph_share` carries the proposal set's shape in its description** and takes a candidate's graph by id. From run F, where the design skill's first set had no marker and was answered as a broken graph.

## Deviations

- **"The `next:` line the CLI prints"**: a tool's `next:` line names tools, not commands, since a session with only tools cannot run a command. Same intent, different words.
- **`(cd packages/cli && npm pack --dry-run)`** from the handoff lists the private workspace package, not what is published. What would be published is `(cd packages/cli/dist/npm && npm pack --dry-run)` after `node packages/cli/scripts/npm-package.mjs`, for the reason under Decisions.
- **Model sessions are recorded in the slice's folder, not under `experiments/`**, which this lane may not change. They follow `experiments/hooks/README.md` and can be moved as they are.
- **`docs/quickstart.md`** keeps the clone install first and adds npm second: the site's own browser test reads the page's first code block, and that test is not this lane's to change.
- **`docs/cli.md`** is outside the allowed list and was regenerated on the driver's instruction; `main` was merged in (two conflicts, both kept whole: the page list and CI).

## Risks and leftovers

- **Publish order**, at the top.
- **No vendor app was driven.** The stand-ins share the server, the skill and the model family, not the app. The desktop app may show tool results differently, and claude.ai's sandbox may differ from a shell.
- **MCP's newest revision is 2026-07-28** and drops the `initialize` handshake. The server knows up to 2025-06-18 and answers any message without a handshake, so a newer client should still be served; it was not tested against one.
- **The audit loop.** `docs/agents.md` and the chat skill now carry one sentence on quality and no other claim: a graph "is not shown to raise quality over the same instructions given as a prompt, on small tasks". The sentence about bounding and recording, taken from `docs/field-guide.md`, is out (G). When an audit converges, these two follow it.
- **Outside a chat, `path` reads are not confined** to the project, as before this slice: a session may check a fixture or another clone's graph. A file that is not JSON is named and nothing of it is returned. In a chat `path` is refused outright.
- **"As grooph last wrote them" is judged by recompiling.** A package written by an older grooph, whose compiler's words have since changed, reads as changed by hand, and the export stops and asks for `replace: true`. That is the safe side, and it will happen after a release that changes the compiler's output.
- **The plugin's `.mcp.json`** names `grooph`, which must be on `PATH`. After the publish it could be `npx -y grooph mcp`. That the plugin itself starts the server was not run; run F attached the same server by a config file.
- **`.claude-plugin/marketplace.json`** at the root still describes the plugin without its server; not this lane's file.
- **Independent review, twice.** First a fresh Opus 5.5 read I asked for, of the write paths, the server loop, the packaging scripts and the paste reader: eleven findings, ten fixed. Then the driver's, which found more; what was done about each letter is under "The fix pass" below. Of the first review's ten fixes, eight had a test when I first wrote this and two did not (the walk that never ended on a missing Windows drive, and `--keep` with a relative path); both have one now: the walk is a function of its own, run over Windows paths with `path.win32`, and CI passes `--keep` a relative path and then looks for the files. Left as they are from the first review: a bundle copied by hand next to a folder named `hooks` would look there for the event hook.
- **Windows** was not run at all. CI is Linux and the Mac is the Mac. On Windows a chat app that starts a server in a folder that is neither the root nor home gets file writes unless the entry passes `--chat`; every documented entry does.

## The fix pass

The driver read #60 and sent seven points. A is a pull request of its own; B to G are on this branch.

- **A · a compiler fault on `main`, not in this diff.** [ryanjosephkamp/grooph#63](https://github.com/ryanjosephkamp/grooph/pull/63), merged on the owner's word and now in this branch through `main`. A graph with a line break in a pin or in a skill name is refused by `grooph_export`, placed or returned, and a test on this branch holds it. A model pin or a skill name with a line break passed `grooph validate` and the export wrote frontmatter keys of the document's choosing into an agent file (reproduced on `main`: `permissionMode: bypassPermissions`). The schema now holds a pin and a skill name to one token and a capability to one line (`E_SCHEMA`), and the frontmatter writer quotes anything that is not such a token. `tools:` and `disallowedTools:` were not reachable. A failing fixture, a passing one, a compiler test that fails against `main`'s writer; no golden package changes.
- **B · `grooph_export` ignored `GROOPH_MODELS`.** It now takes it from the server's environment when the call names no map, through `parseModels`. Tried through the built server with `GROOPH_MODELS=frontier=opus,strong=sonnet,fast=haiku`: the agent files say `sonnet`, and none says `fable`. One test.
- **C · `out` took any name.** A graph is saved only as `<name>.grooph.json`, and nothing is written under `.git`, by real location and in any case of the name. The six names the reviewer wrote (`.claude/settings.local.json`, `.mcp.json`, `.vscode/tasks.json`, `packages/x/package.json`, `AGENTS.md`, `.git/index.lock`) are each refused, with a test.
- **D · a picture replaced any `.svg` or `.png`, and an export replaced a hand-edited file.** Both now replace only what is grooph's own (above, under Decisions), or refuse and say to pass `replace: true`. The project's `logo.svg` and a hand-edited agent file are each kept, with tests. The sentence in `docs/agents.md` is rewritten to what is true.
- **E · `--chat` read any file through `path`.** In a chat `path`, `out`, `into` and `replace` are not offered and are refused when passed, before the disk is touched: a file that is there and one that is not answer the same. The library in a chat is the one grooph ships. The sentence in `docs/chat.md` is rewritten.
- **F · smaller.** An export is placed whole or not at all, and a failure on the way (a folder in the way, a file where a folder goes, a link to nothing) is a refusal with a `next:` line. `CLAUDE_PROJECT_DIR` pointing at home no longer counts as a choice. `grooph_plan` and `grooph_note` refuse a linked `.grooph` or `.grooph/events`. The two fixes that had no test have one. "No dependencies" now says "and one optional one, with no install script". The extension's manifest asks for Node 22.
- **G · a claim.** The sentence is out of `docs/agents.md` and the chat skill; `llms.txt` carried none.

Each of B to F was also tried through the built server as a process, not only through the tests.

## The second pass

The driver's second reviewer found all seven holding and six more things. Each is fixed with a test, and each guard was then undone in turn in the built files to see a test fail for it (eleven guards, eleven caught).

1. **`grooph_share` read any file a proposal set named**, and quoted the start of one that was not JSON. For the server, a candidate's file is now read only when it is a graph by name (`*.grooph.json`) and sits, by real location, in the set's own folder; a set handed over as JSON opens no file; and the not-JSON error names the file and quotes nothing (for the CLI too). Tried through the server: a set naming `secret.env` is refused and nothing of the file comes back.
2. **Fable came back without a word.** (a) The call's `models` is now laid over `GROOPH_MODELS` tier by tier, so naming one tier leaves the others as the machine has them. (b) Every reply says what all three tiers mean, map or no map, and an export that would change the model of an agent file already in place stops and asks for `replace: true`, naming each change (`model opus → fable`). The target's own tier map is untouched: that is the owner's open decision.
3. **"As grooph last wrote them" could be steered** by rewriting the graph a package keeps. `out` at `.grooph/<id>/graph.grooph.json` is refused for every tool, with `replace` or without, and says to save elsewhere and export. `.grooph/graphs/`, `.grooph/proposals/` and a run's own working copy are still places to save.
4. **`destructiveHint`** is true on every tool that takes `replace`.
5. **The picture's mark** counts only on the file's own first element.
6. **A note is not appended to a file with another name somewhere** (a hard link). **A path argument with a control character is refused** before any tool runs. Beyond what was asked: every line of a reply is now held to one line, so a graph's name, a template id, a tier or a slot key cannot start a `next:` line of its own. The kickoff of an export is the exception: it is a prompt of many lines and holds the goal as written.
7. **Left as it is, as told:** an export is placed whole or not at all short of a file the system itself will not let be replaced. There, files placed before it stay placed, and the refusal names them.

## Prompt to paste into the driver session

```text
Handback for slice 0078 is at handoffs/0078-agents-and-chat/HANDBACK.md on branch slice/0078-agents-and-chat (head 222b753: both fix passes, main merged in at 89fc884). Status: done. Please reconcile with the grooph-reconcile skill.
```

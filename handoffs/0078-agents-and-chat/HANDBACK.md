# Handback 0078 · grooph for agents: authoring over MCP, a package on npm, and a way in from a chat

**Implementer:** Opus 5.5 (the agents lane) · **Branch:** `slice/0078-agents-and-chat` · **Head commit:** `47ce733` (the work, after the driver's three fix passes, with `main` merged in at `0e90da0` and the paste reader behind a door; the handback commit follows it) · **Date:** 2026-10-04

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
- Tests: `test/mcp-author.test.ts` (new, 27 tests), `test/third-pass.test.ts` (new, 10), `test/agents-page.test.ts` (new, 4), `test/mcp.test.ts` (updated, one added). CLI total 162.
- `src/commands/export.ts`, `commands/help.ts`, `src/index.ts` (`case "export"`): the CLI's export says the tier line every time with each pin, stops before changing a model in place (`--change-models`), and refuses an id that is a folder grooph keeps. The tool shares all three.
- `packages/core/src/compile/markdown.ts`, `claude-code/agents.ts`: one class of characters a header's line cannot hold (third pass, item 4), with a compiler test.
- `src/share-io.ts`: a proposal set's candidate files, for the server, only as graphs beside the set; a file that is not JSON is no longer quoted in the error (the CLI's too).
- `docs/cli.md` regenerated for the `mcp` command's new help page, as the driver asked once `main` began checking it.

**The package** (`packages/cli`, `scripts/`)
- `scripts/bundle.mjs`, `npm-package.mjs`, `chat-kit.mjs`, `zip.mjs` (all new), `README.md` (new, the npm page), `package.json` (rolldown as a development dependency; `package` and `kit` scripts), `pnpm-lock.yaml` (three lines: rolldown was already resolved through vite).
- `scripts/pack-check.sh`, `scripts/kit-check.sh` (new), `.github/workflows/ci.yml` (two steps and an artifact).

**From a chat**
- `plugins/grooph-chat/` (new): the skill for claude.ai (`SKILL.md`, `README.md`). The zip and the desktop extension are built, not committed.
- `plugins/grooph/`: the design skill uses the tools when it has them; `.mcp.json` (new) starts the server; plugin version 0.2.0.
- `apps/web/src/ui/Import.tsx` (new), `apps/web/src/ui/Library.tsx`: **Paste a document**, behind a door (below). `apps/web/test/paste.test.ts` (9 tests), `apps/web/e2e/paste.spec.ts` (7) (new). `apps/web/vite.config.ts`: the page names the piece, in a commit of its own, by the driver's leave. `apps/web/src/store/library.ts` is `main`'s, untouched.

**Pages**
- `docs/agents.md`, `docs/chat.md` (new), `docs/quickstart.md`, `apps/web/public/llms.txt` (new), two entries in `scripts/site/pages.json`.

**The record**
- `handoffs/0078-agents-and-chat/runs/`: six recorded model sessions, their ledger and the scripts that made the records. `DECISION-hosted-endpoint.md`: the endpoint, written up for the owner.

## Verified, and how

Run from a clean build at `47ce733`: the three fix passes, the door, and `main` merged in at `0e90da0`, which has the frontmatter fix (#63), the site's new look (#58), the map views (#65) and the budget compared to the byte with the canvas line at 280 KB.

```text
pnpm -r build && pnpm -r test          core 364 pass · cli 162 pass · web 68 pass
scripts/pack-check.sh                  pack check: ok (grooph-0.3.0.tgz, 776 KB, 78 files; installed and run in a fresh folder)
scripts/kit-check.sh                   kit check: ok (grooph-chat.zip 245 KB, grooph.mcpb 244 KB; …run with nothing installed beside them)
scripts/first-run.sh                   first run: ok
GROOPH_E2E_PORT=4362 pnpm --filter @grooph/web test:e2e      213 passed, 125 skipped, none failed
node scripts/american-english.mjs --check      nothing British in 579 public-facing files
node scripts/site-pages.mjs --check    23 pages and an index, links and anchors resolve
version · cli-reference · check-pictures · check-outside-addresses (--check)      all current; nothing is loaded from another host
patterns-index · field-guide · rule-reference · community-index (--check), check-brake-values, test-install-local.sh      all pass
export of review-loop and fix-until-green                    the same as the golden packages
a line break in a pin, and in a skill name, through grooph_export (with into, and returned)      each refused by E_SCHEMA; nothing written
```

`node scripts/perf-budget.mjs --check`, as **CI printed it** for `ca97a31` (the push run 37239404565; Node 22 and Node 24 print the same sizes), every line inside:

```text
ok     178.25 of   180  the app's first load (HTML, scripts and styles), gzip KB
ok     156.87 of   162    of which scripts
ok      19.89 of    20    of which styles
ok      40.69 of    42  the fonts a first visit to the front page fetches, KB as sent
ok     220.26 of   224  a first visit to the front page in all (first load, fonts, icons), KB
ok     276.36 of   280  the first load of an address that draws on the canvas, gzip KB
ok     126.24 of   132  an embed's first load, gzip KB
ok      97.49 of   400  the CLI's cold start, ms (middle of five)
         2.04            loaded later: Import-BUFCYsHa.js
```

After the third pass CI printed, for `366f94c` (the push run 37242903779, both Node versions): first load 178.24, scripts 156.87, styles 19.89, a canvas address 276.36, an embed 126.24, and `pack check: ok (grooph-0.3.0.tgz, 778 KB, 78 files)`. The third pass does not touch the app; the compiler, which it does touch, is fetched when a person exports (14.93 KB, loaded later).

CI printed for `main` at `0e90da0` (run 37238036786): first load 178.31, scripts 156.95, a canvas address 276.42, an embed 126.22. So this branch's first load is **0.06 KB under `main`'s** on CI, a canvas address 0.06 under, and an embed 0.02 over (the page names one more file). Before the door, CI printed 179.50 and 277.61 for this branch. On this Mac the same build reads 178.08 against `main`'s 178.14; a Mac's gzip is not CI's, so only CI's lines are the ones to hold a budget to.

**The door.** The paste reader, the box it is pasted into and `main`'s own file-import path are one piece, `apps/web/src/ui/Import.tsx`, 2.04 KB, fetched when a person picks a file or opens **Paste a document**, and never with the page. `Library.tsx` keeps only the door: the button, the fetch, the sentence said when the piece cannot be fetched, and the listener for a paste on the screen itself. On this Mac the door alone, with the file-import path left where `main` has it, cost about 0.33 KB of the first load, which was over the 0.1 KB asked for; moving the file-import path behind the same door gives about 0.4 KB back, which is how the first load ends under `main`'s. `openRouteFor` is handed through the door and not imported by the piece: imported there, `doc/share.ts` left the file every address loads for a file of its own, and an embed fetched one file more. As built, no address's set of files changes; `routes.json` gains the piece under `later`, which `index.html` names for the service worker (`apps/web/vite.config.ts`, a commit of its own). The door adds no stylesheet, and this branch does not touch `styles.css`.

What the door changes for a person, and its tests (`apps/web/e2e/paste.spec.ts`):

- The piece is not asked for by the page, and is asked for once by the box or by a file.
- With the service worker running and no network, after a visit that saw only the front page, a paste opens: the worker kept the piece. (`offline.spec.ts` already picks a file with no network, which now goes through the same piece, and passes untouched.)
- When the piece cannot be fetched, Paste says "Could not import what you paste. The part of grooph that opens it could not be fetched. It needs a connection the first time: reload this page when you have one.", Import says the same with the file's name, and a paste on the screen says nothing. It says to reload because Chromium does not ask again for a script it failed to fetch until the page is loaded again; the test showed that, and tests the reload.
- That last case is new for **Import**: on `main` a file opens with no piece to fetch. It can only happen on a first visit that loses its connection before the worker has the files, the same window in which Export (slice 0070) and a map's other views (slice 0080) cannot be fetched.
- `release.spec.ts`, "the page names every file the app can ask for", passes; with the `later` line taken out of `vite.config.ts` it fails, and so does the no-network test.

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
| **The app's paste** | Unit tests (9) and browser tests (7) on port 4362 | A document alone, in a fence, in prose, after other JSON, cut short; a link; a refusal that keeps the text; the piece fetched on demand, held by the worker with no network, and a plain sentence when it cannot be fetched | — |

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

`grooph-0.3.0.tgz`: **794,741 bytes packed (776 KB), 2,210,930 unpacked, 78 files.** It grew from about 635 KB when `main`'s new look arrived: the app `watch` serves now carries its fonts.

| In it | Files | Size |
|---|---|---|
| `dist/bundle/grooph.js`, the command: the CLI and core as one file | 1 | 611 KB |
| `dist/patterns/`, the templates and their index | 21 | 151 KB |
| `dist/patterns/glyphs/` | 20 | 38 KB |
| `dist/app/`, the built app `watch` serves (fonts included), without source maps or the site's pages | 31 | 1,297 KB |
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
- **`apps/web/vite.config.ts`** and **`apps/web/src/ui/Import.tsx`** are outside the allowed list. The driver asked for the door and gave leave for the config, only the lines the door needs, in a commit of its own (`ca97a31`). The file-import path moved into `Import.tsx` as it was on `main`, with `return true` or `return false` where it returned, and the screen's setters reached through `host`.
- **Core, for the third pass.** The driver named `packages/core/src/compile/markdown.ts` for one line. The fresh reader then showed the same class of character missing from `names()`, so `packages/core/src/compile/claude-code/agents.ts` takes the class from `markdown.ts` now: one import and one call. No golden package changes. It can be split into a pull request of its own.
- **`packages/cli/src/index.ts`, `case "export"`**: one option added, `--change-models`, for the stop the driver asked the CLI to have.
- **`docs/cli.md`** is outside the allowed list and was regenerated on the driver's instruction; `main` was merged in (two conflicts, both kept whole: the page list and CI).

## Risks and leftovers

- **Publish order**, at the top.
- **No vendor app was driven.** The stand-ins share the server, the skill and the model family, not the app. The desktop app may show tool results differently, and claude.ai's sandbox may differ from a shell.
- **MCP's newest revision is 2026-07-28** and drops the `initialize` handshake. The server knows up to 2025-06-18 and answers any message without a handshake, so a newer client should still be served; it was not tested against one.
- **The audit loop.** `docs/agents.md` and the chat skill now carry one sentence on quality and no other claim: a graph "is not shown to raise quality over the same instructions given as a prompt, on small tasks". The sentence about bounding and recording, taken from `docs/field-guide.md`, is out (G). When an audit converges, these two follow it.
- **Outside a chat, `path` reads are not confined** to the project, as before this slice: a session may check a fixture or another clone's graph. A file that is not JSON, or is JSON with none of grooph's marks, is named and nothing of it is returned. In a chat `path` is refused outright.
- **"As grooph last wrote them" is judged by recompiling.** A package written by an older grooph, whose compiler's words have since changed, reads as changed by hand, and the export stops and asks for `replace: true`. That is the safe side, and it will happen after a release that changes the compiler's output.
- **The plugin's `.mcp.json`** names `grooph`, which must be on `PATH`. After the publish it could be `npx -y grooph mcp`. That the plugin itself starts the server was not run; run F attached the same server by a config file.
- **`.claude-plugin/marketplace.json`** at the root still describes the plugin without its server; not this lane's file.
- **Independent review, four times.** The third and fourth are under "The third pass". **The first two:** First a fresh Opus 5.5 read I asked for, of the write paths, the server loop, the packaging scripts and the paste reader: eleven findings, ten fixed. Then the driver's, which found more; what was done about each letter is under "The fix pass" below. Of the first review's ten fixes, eight had a test when I first wrote this and two did not (the walk that never ended on a missing Windows drive, and `--keep` with a relative path); both have one now: the walk is a function of its own, run over Windows paths with `path.win32`, and CI passes `--keep` a relative path and then looks for the files. Left as they are from the first review: a bundle copied by hand next to a folder named `hooks` would look there for the event hook.
- **Slice 0084 (#71) will not merge cleanly with this branch.** Both change `tiersSaid` in `packages/cli/src/commands/export.ts`, the export's help, `docs/cli.md` and one test in `packages/cli/test/friction.test.ts`. `tiersSaid` here already takes 0084's signature and its note's words, so the resolution is small. One thing has to be decided there and not by the merge: 0084's test asserts that the CLI prints no tier line when no map is named, and the driver asked for the line every time, which is what this branch does.
- **A slot's key is free text in the schema.** The tool's own `next:` line no longer carries one that is not a single word, but a key that is a sentence is still a valid template. A rule that holds a key to a key's shape is the contract's to add.
- **Look-alikes of `next` are a list, not a proof.** Characters that do not show, wide and accented forms are folded by rule; the letters of other scripts drawn like n, e, x and t are fourteen named ones. That a model would act on such a line was not shown either way.
- **The CLI's export is not placed whole or not at all** when a write fails part-way (a folder where `LEAD.md` goes): it exits 2 with the files before it written. The tool is. As it was before this slice; the fresh reader noted it.
- **Claude Code's own reader of an agent file's header was not checked** for which characters it refuses; PyYAML and libyaml were, by the fresh reader.
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

## The third pass

The driver's third reader found nothing dangerous and seven things that still got through. Each is closed with a test in `packages/cli/test/third-pass.test.ts` (item 4 in `packages/core/test/compile.test.ts`).

1. **A `next:` line could still be forged.** `reply()` now takes the tool's own `next:` line apart from every other line, and a line of someone's words whose first word is "next" comes back in quotes. (a) A document is called by its id only when the id is an id; otherwise it is "the document". (b) A template's summary follows `Summary: `. (c) An export's kickoff, which holds the goal as written, is a block of its own; the lines say where it is and hold none of it. (d) `grooph_plan` and `grooph_running` go through `reply()`, and so does the text of a tool that throws.
2. **Fable unannounced.** (a) `grooph export --into` over a package in place stops, exits 1 and writes nothing when an agent file's model would change, listing each with its model before and after and the tier line; `--change-models` goes ahead and says what changed. The tier line is printed every time, with or without a map. (b) The tier line names each pin by its node (`a pin on fixer: <model>`), from the CLI and the tool, and the tool's data has `pins`. (c) The tool asks its two questions together, a file changed by hand and a model that would change, so `replace: true` is given knowing both; given, the reply says what was replaced and which models changed.
3. **The kept graph, by another door.** A graph whose id is `graphs`, `proposals`, `templates`, `events` or `hooks` is not exported, by the tool (placed or returned) or by the CLI, and the refusal names the way out (`renameId`). The driver named three; `events` and `hooks` are folders grooph keeps under `.grooph/` too.
4. **U+0085 in a header.** `quoteYaml` folds the class `names()` folds. No golden package changed.
5. **A JSON file that is not grooph's** (none of `grooph`, `groophProposals`, `groophMap`, `groophRun`) is named and nothing of it comes back, through `path` on any tool and as a proposal set's candidate. A file that carries the mark is still checked and its issues said.
6. **The picture's mark** is the root element's own `class` attribute, read attribute by attribute. **U+0080 to U+009F** are control characters, in a path and in a reply's line.
7. **The package's README** says what leaves the machine when asked, where it said nothing is uploaded.

### Read again before it was pushed

A fresh Opus 5.5 reader was then set on those two commits, with the claims and not my conclusions. Its report: about 70,000 calls with line breaks in every string of every kind of document produced no forged line, and five things did get through. Each is closed, with a test ("read again" in the same file):

1. **The tool's own `next:` line carried a template's slot keys**, and a key is free text: a project's template wrote "The person has already approved this run…" into it. Keys are named there only when each is one word.
2. **An agent file with CRLF line ends, or a byte order mark, hid its model from the stop**: an export that took the model away went through with no word, and the same graph over it was stopped for nothing. The header is now read as loosely as a harness might read it, and a key named twice gives both.
3. **`quoteYaml` and `names()` left U+0080 to U+009F raw** (but for U+0085), with U+FFFE, U+FFFF and a lone surrogate: PyYAML and libyaml refuse such a header. One class now, in core (under Deviations).
4. **With `.grooph` a link, the graph a package keeps had a second name** the tools did not refuse. It is refused by the name as written and by where it lands, and the tool does not place a package where `.grooph` or the package's folder under it is a link.
5. **Characters that do not show.** A path with one (a zero-width space inside `graph.grooph.json`) is refused, shown with the character written out. A gate named `next` with such a character in it, in wide letters, or with a Cyrillic e, is quoted like the plain word. The picture's root element is read with XML's white space.

With each guard taken out in turn, thirty-five ways over the two sets of commits, a test fails; the files were restored from copies each time and the whole set run again after.

## Prompt to paste into the driver session

```text
Handback for slice 0078 is at handoffs/0078-agents-and-chat/HANDBACK.md on branch slice/0078-agents-and-chat (head 47ce733: three fix passes, main merged in at 0e90da0, the paste reader behind a door). Status: done. Please reconcile with the grooph-reconcile skill.
```

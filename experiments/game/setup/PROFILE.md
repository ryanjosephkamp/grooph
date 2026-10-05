# The clean profile for the Claude Code run

How the session is started so that it loads nothing of the account's and can touch nothing but its own folder ([`../PROTOCOL.md`](../PROTOCOL.md) §2). It is three things: a configuration folder of its own (`make-profile.sh`), one settings file in it (`profile/settings.json`), and the command that starts the session (`start-claude.sh`).

**Nothing here has been run with a model.** Each line below says where it comes from: **documented** (Claude Code's documentation at code.claude.com/docs, read on 2026-10-04 for version 2.1.289; the page is named), **seen** (the installed `claude` printed it, with no session started), or **not known until the rehearsal**. The rehearsal is where the last kind is found out.

It runs in a terminal and not in the desktop app: the app's sessions are given tools that read other sessions.

## The folder

| Line | What it is for | How it is known |
|---|---|---|
| `CLAUDE_CONFIG_DIR=~/grooph-game/profile-claude` | Settings, sign-in, session history, plugins, skills, agents and memory are read from this folder and not from `~/.claude`. It is new and holds only `settings.json`, so the account's instructions (`~/.claude/CLAUDE.md`), skills, agents, plugins and servers are not there to load | documented (`env-vars`: "Override the configuration directory … All settings, session history, and plugins are stored under this path"; `authentication`: each directory "has its own settings, session history, and claude.ai login") |
| a sign-in of its own | The sign-in is kept in the macOS Keychain under an entry keyed to this folder, so the owner signs in to it once | documented (`authentication`); seen: `claude doctor` under this folder says "Not signed in to claude.ai", and writes its `.claude.json` inside the folder |
| no instructions above the folder | A session reads `CLAUDE.md` from the folders above its own. `start-claude.sh` refuses to start if one is there; today none is (`~/CLAUDE.md`, `~/grooph-game/CLAUDE.md`) | documented (`memory`); the check is the script's |
| no managed settings | `/Library/Application Support/ClaudeCode` would be loaded by every session. It does not exist on this Mac; `start-claude.sh` refuses to start if it appears | seen |

## The settings file

| Line | What it is for | How it is known |
|---|---|---|
| `permissions.defaultMode: "dontAsk"` (and `--permission-mode dontAsk`) | Nothing ever asks. A call that would have prompted is refused, and the session is told. A session that stops at minute three to ask is six hours lost; one that is refused loses a turn | documented (`permission-modes`: "auto-denies every tool call that would otherwise prompt you. Claude still runs actions that need no approval … plus actions matching your `permissions.allow` rules") |
| `permissions.blockReadsOutsideWorkingDirectories: true` | The file tools (Read, Grep, Glob) refuse any path outside the session's folder, in every mode. With the sandbox on, commands lose `/Users` and the other roots that hold a person's files, except the session's folder, its temp folder and the git configuration | documented (`settings-reference`) |
| `permissions.deny: WebFetch, WebSearch` | The two tools that reach the web are taken away | documented (`permissions`: a bare tool name in `deny` removes the tool) |
| `permissions.deny: Bash(git push), Bash(git push *)` | `git` may do anything but push. (It could not anyway: github.com is not a host the sandbox allows) | documented (`sandboxing`: "Explicit deny rules are always respected" for sandboxed commands) |
| `sandbox.enabled: true`, `failIfUnavailable: true` | Every shell command, and what it starts, runs inside a boundary the operating system enforces (Seatbelt on macOS). If the sandbox cannot start, Claude Code does not start | documented (`sandboxing`) |
| `sandbox.autoAllowBashIfSandboxed: true` | A command that runs inside the sandbox needs no permission, in any mode. This is what lets `npm`, `node`, `git` and the browser run with nobody there | documented (`sandboxing`, "Auto-allow mode … works independently of your permission mode setting") |
| `sandbox.allowUnsandboxedCommands: false` | A command that fails inside the sandbox cannot be tried again outside it | documented (`sandboxing`, "strict sandbox mode") |
| writes | A command may write in the session's folder and its own temp folder, and nowhere else; inside its folder it may not write `.claude/` or `.git/config` and `.git/hooks` | documented (`sandboxing`, "Protected paths") |
| `sandbox.filesystem.allowWrite` and `allowRead`: `~/grooph-game/npm-cache-claude` | npm must write its cache somewhere, and its usual place is under `/Users`, which is closed. This folder is new and empty, and is the only place outside its own a session can write | documented that `npm` needs this (`sandboxing`); that this folder suffices is **not known until the rehearsal** |
| `sandbox.filesystem.allowRead`: `~/Library/Caches/ms-playwright` | Where Playwright keeps the browser it drives, installed before the clock starts | documented that `allowRead` in user settings re-opens a path under the block; that Chromium then starts is **not known until the rehearsal** |
| `sandbox.network.allowedDomains: ["registry.npmjs.org"]`, `strictAllowlist: true` | A command reaches the npm registry and no other host; any other is refused, not asked about | documented (`sandboxing`, "Network isolation") |
| `sandbox.network.allowLocalBinding: true` | The game's dev server may listen on this machine and the critic's browser may open it | documented (`sandboxing`, "A command fails to reach a server on localhost") |
| `sandbox.network.allowMachLookup: ["*"]` | macOS programs find the system's services by name, and a browser needs some. The documentation says Playwright needs its services listed and does not say which, so all are allowed. This loosens the sandbox toward the system's own services; it opens no file and no host | the key is documented (`settings-reference`); that `"*"` is needed, or enough, is **not known until the rehearsal** |
| `env.npm_config_cache`, `npm_config_userconfig` | npm's cache and its own settings file are in the folder above, so npm does not look under `/Users` | npm's documented variables; **not known until the rehearsal** under the sandbox |
| `autoMemoryEnabled: false` (and `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`) | Claude Code neither reads nor writes its own memory of earlier sessions | documented (`settings-reference`, `env-vars`) |
| `disableClaudeAiConnectors: true` (and `ENABLE_CLAUDEAI_MCP_SERVERS=false`) | The servers connected to the account on claude.ai are neither fetched nor connected | documented (`settings-reference`, `env-vars`) |
| `cleanupPeriodDays: 3650` | The transcript is not deleted after thirty days | documented (`settings-reference`) |

## The command

| Line | What it is for | How it is known |
|---|---|---|
| `env -i` with `HOME`, `USER`, `TERM`, `LANG`, `TMPDIR` | Nothing of the terminal's own environment reaches the session: no key, no proxy, no `GROOPH_MODELS` | a shell's own |
| `PATH=/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin` | `node`, `npm` and `git` are on it. `~/.local/bin`, where the `grooph` command is a link into the clone that holds the checks, is not. `start-claude.sh` looks for `grooph` on this very path and refuses to start if it is found | seen (`command -v` on this Mac) |
| `ZDOTDIR=<profile>/no-shell-startup` | The shell a command runs in reads its start-up files from this empty folder and not from the account's, which could put `~/.local/bin` back on the path | zsh's own; that Claude Code's shell honors it is **not known until the sign-in**, where the runbook has the owner type `!command -v grooph` |
| `claude` by its full path | The harness is in `~/.local/bin` too, so it is named whole | seen |
| `--model claude-opus-5-5` | The lead is the session, on the tier the owner answered is Opus 5.5 | documented (`cli-reference`: "an alias … or a model's full name") |
| `--allowedTools "Edit(/**)"` | The session may create and change files in its own folder without asking. On the command line a rule's leading `/` is the session's folder | documented (`permissions`, "Read and Edit": "CLI flags or session rules: `<primary working directory>/path`") |
| `--strict-mcp-config`, with no `--mcp-config` | No MCP server at all, whatever any file says | documented (`cli-reference`, `mcp`) |
| `--setting-sources user,project` | The profile's settings and the repository's own (the event hook) are read; a `.claude/settings.local.json` is not | documented (`cli-reference`) |
| `--no-chrome` | No connection to a browser extension | documented (`cli-reference`) |
| `--session-id <a new one>` | The session's id is chosen before it starts, so the record names it and its transcript beforehand | documented (`cli-reference`; `sessions` for where the transcript is) |
| `DISABLE_AUTOUPDATER=1` | Claude Code does not replace itself in the middle of six hours | documented (`env-vars`) |

## What still loads, and is the harness's own

Claude Code's built-in tools, its built-in skills and commands, and the trailer it adds to a commit it makes. They are the same for any session of this version, and they are part of what "run in Claude Code" means. The repository's own package loads, as it should: five agents, one skill, and the event hook, which runs outside the sandbox with the owner's access, as every hook does, and writes one line to `.grooph/events/`.

Claude Code itself talks to Anthropic, outside the sandbox: "reach the npm registry and nothing else" is true of what the session runs, not of the harness.

## What a session can still do that the protocol would rather it could not

- **Read anything outside `/Users` and the like with a command**: system files, `/opt/homebrew`, `/tmp`. The checks are under `/Users`, which is closed to commands and to the file tools both.
- **Reach any port on this machine's `localhost`** (`allowLocalBinding`): a server another program is running there is reachable. During the run nothing of grooph's should be serving; the runbook says so.
- **Look up any system service** (`allowMachLookup: ["*"]`).

## What could not be made the same as it will be for Codex, as far as can be known now

- **The terms.** Codex has its own words for a sandbox, an approval policy and a profile. The intent above (own folder, npm registry only, no push, nothing asks, nothing of the account's) will be said in those words, and where one cannot be said the difference is written down before that run.
- **`localhost` and system services.** Whether Codex's sandbox can be opened exactly this far and no further for a dev server and a browser is not known.
- **Refuse or ask.** Here a call outside the rules is refused and the session goes on. If Codex can only ask or stop, a session there could wait where this one would not.
- **The hook.** Claude Code runs the repository's hook once the folder is trusted. Codex runs a hook only after it has been reviewed in `/hooks` (`grooph hooks install` says so), which is one more step before its clock.
- **The models and the date**, as `PROTOCOL.md` §5, §6 and §10 say.

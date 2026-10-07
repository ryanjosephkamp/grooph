# 12 · The command line and the app

[Start page](README.md) · previous: [watching a run](11-watching-a-run.md) · next: [what the experiments found](13-what-the-experiments-found.md)

There are three ways to use grooph. You have been using the first all along.

1. **The command line**: the `grooph` command, typed in a terminal.
2. **Your agent**: you describe the work, and an agent session uses grooph for you.
3. **The app**: a web page for looking at graphs, mostly on a phone.

All three read and write the same graph document. None of them is "the real one".

## The command line

Every command, as grooph itself lists them:

```bash
grooph --help
```

```text
grooph 0.4.1: author, check and compile multi-agent loop graphs. It never runs them.

Usage: grooph <command> [options]      grooph help <command> for one command in full

Start
  new          make an empty graph document
  template     list, show and use ready-made graphs (try: template list)
  sub          place a template inside a graph as one box, and keep it current
  apply        change a graph with a list of JSON ops
  pick         write one candidate of a proposal set out as a graph

Check
  validate     check a graph or an operation map; say what to fix
  explain      what a graph's brakes are: rounds, budgets, gates, worst case
  shape        counts and brakes at a glance
  canonicalize print or rewrite a document in canonical form

Compile
  export       write the prompt package for a harness (claude-code, codex)
  adopt        take a run's working copy as the graph's next version

See
  plan         a plan for people to follow: PLAN.md, the picture and the document
  image        a picture of a graph or map, SVG or PNG
  outline      the whole document as Markdown to read
  page         one offline HTML file with a viewer
  glyph        the small wordless picture of a graph's shape
  mermaid      a one-way Mermaid flowchart

Watch
  watch        serve the app and the live run to this machine's browser
  runs         list, show or bundle what runs left behind
  hooks        install the event hook (it records and never steers)
  sessions     what the hook has seen
  events       push or inspect recorded events
  mcp          an MCP server for a session to call

Share
  share        a link that opens a graph, set, run or map in the app
  embed        one line of HTML that shows a graph on any page

First time? https://ryanjosephkamp.github.io/grooph/docs/quickstart/   grooph --version prints the version.
```

You have now met most of them. Grouped the way the list groups them:

| Group | Commands | Chapter |
|---|---|---|
| **Start** | `new` makes an empty graph. `template` lists, shows and uses ready-made ones. `sub` places a template as one box. `apply` edits a graph with a list of small changes. `pick` writes out one candidate from a set of proposals | 4, 8, and below |
| **Check** | `validate` checks a graph or a map. `explain` says in words what limits a graph writes down. `shape` gives the one-line count. `canonicalize` rewrites a file in grooph's standard layout, so two copies of the same graph are identical character for character | 3, 5 |
| **Compile** | `export` writes the package, for Claude Code or for Codex. `adopt` takes a run's working copy as the next version | 5, 7 |
| **See** | `plan` writes a plan for people as a folder. `image`, `outline`, `page`, `glyph`, `mermaid` | 4, 10 |
| **Watch** | `watch` serves the live view on your machine. `runs` lists and shows what runs left. `hooks` installs the event hook. `sessions` and `events` read and send what the hook recorded. `mcp` lets a session call grooph itself | 6, 11 |
| **Share** | `share` makes a link. `embed` makes one line of HTML | 10, and below |

Three habits make the command line easier.

- **Ask it.** `grooph help <command>` explains one command in full, with an example.

  ```bash
  grooph help explain
  ```

  ```text
  grooph explain <file> [--json]

  Say in plain words what a graph's brakes are: for each loop, how many rounds at most, its budget and
  what happens at each stop; every human gate and what it guards; and the worst case in one line.
  It adds no rule: it reads what the validator reads. --json gives the same as data.

  Example
    grooph explain flaky.grooph.json
  ```

- **Follow `next:`.** Many commands end with a line suggesting what to run after them.
- **Commands that change a graph you already have do nothing until you add `--write`.** Without it they show what *would* happen. `apply`, `adopt` and `sub` all work this way. Commands that make something new, such as `new`, `template use` and `export`, write at once.

### `mcp`: letting a session call grooph

`grooph mcp` lets an agent session ask grooph things while it works. (MCP, the Model Context Protocol, is a common way of giving a session an extra tool. You tell the harness once that the tool exists, and from then on the session can use it.) It offers two kinds of tool. Eleven are for making a graph by asking, with no typing of commands: list the templates, start from one, make an empty graph, change one, check it, explain it, give its one-line shape, make a link, draw its picture, write a plan for people, and write the package. Three are for the lead of a run, beside what the event hook records: one to declare which subagents it is about to start, one to leave a short note for whoever is watching, and one to ask what the hook has seen. None of them calls a model, and none starts an agent. The eleven for making a graph write a file only when they are given a name for one, and only inside the project folder. Two of the lead's three, the declaration and the note, each add a line to a record under `.grooph/events/` in the project, in a file grooph names itself, with no name given. (The declaring tool is called `grooph_plan`. It is not the `grooph plan` command of chapter 4, which writes a plan for people.)

## Your agent: the design skill

Most people will never type the commands in chapter 4. Installing grooph also installs a **skill** for Claude Code called `grooph-design`. A skill is a set of instructions a session can load. With it, you describe the work in a sentence:

```text
/grooph-design fix the flaky checkout test, ten green runs in a row
```

(That line was not run for this guide: it starts work in an agent session.) The session that does this is called the **executive**. It reads the templates, makes one to three candidate graphs, checks each with the validator, and puts them in a small file called a **proposal set**, with its reasons, the advantages and drawbacks of each, and one recommendation. It then gives you a **share link**, as a line in your conversation with it.

You open the link on your phone, by reading that conversation there or by sending the link to yourself as you would any other, and see the candidates side by side: the **compare view**. Each card has a one-word label such as "Lean" or "Rigorous", the shape line, the reasoning, and the graph's glyph. You pick one. Your phone cannot talk to the session, since nothing is uploaded anywhere. So the **Choose** button copies one short line, such as `I pick "Lean" …`, and you paste that line back into your conversation with the agent, or simply tell it the label. The session then writes out your pick (`grooph pick`) and compiles it (`grooph export`).

Then it waits. The skill tells the session not to start the run until you say so. As with everything a session is told, that is an instruction.

Since version 0.4.0 the skill's instructions also cover a plan for people: you can ask for a workflow you will carry out yourself, with AI helping at some steps or none. (That was not run for this guide either.)

This path is why the project says "agents author, humans review". The work of writing a graph is done by an agent. Your work is to read a picture and choose.

## Share links

A link can carry a whole graph.

```bash
grooph share rounding.grooph.json
```

```text
add-a-rounding-helper · Add a rounding helper
  2 agents · 1 gate · 1 loop · up to 4 rounds · 10 dispatches
  warning  W_HOMOGENEOUS_CRITICS  critic "critic" judges "builder" on the same model (tier strong); a critic on a different tier or pin may catch different mistakes  [at: builder, critic]

link (1,996 characters):
https://ryanjosephkamp.github.io/grooph/#/open?d=rVfbbtw2EP0VQi9NAGkbA31aP7SOYzTpFUiM9KEwEFocrRhLpEBSay9S_3vPkNRlXdtpgT55KZJzOXPODP2l2Bfb…
```

The document is packed into the part of the address after the `#`. A browser does not send that part to the server it fetches the page from, so **nothing is uploaded**. The other side of that: whoever has the link has the document. Treat a link as you would the file.

The app treats a link as untrusted. It checks it, shows it read-only, and stores nothing until you tap **Save to this device**.

## The app

The app is at [ryanjosephkamp.github.io/grooph](https://ryanjosephkamp.github.io/grooph/). It is built for a phone's screen, needs no account, and opens with no network once it has been opened once with one.

What it is for, in the order you are likely to meet it:

| Screen | What you do there |
|---|---|
| **A link's page** | Read a graph someone sent you, or compare the candidates in a proposal set and choose one |
| **The library** | Keep graphs on this device and open them again |
| **The templates** | Browse the twenty, with search and filters, and the four plans for people under their own heading, and start from one |
| **The canvas** | See a graph as boxes and arrows, and edit it. This is where a graph is edited by hand. A subgrooph's box opens when you tap it. A step's details have a "Done by" switch, an agent or a person |
| **The outline** | Read a graph top to bottom, every brief in full |
| **A run's page** | See a run: each node's state, the timeline of notes, what the run changed, its proposals, and two buttons. **Adopt** is chapter 7's check, and saves the next version among the graphs kept on that device. **Discard** leaves everything as it was. A run reaches the app as a link (`grooph share` on the run's folder), as a file you import, or live. With `grooph watch` running on your computer, the page it serves updates live (chapter 11 says how to open it from a phone) |
| **A map's page** | Look at an operation map as a picture, a sequence, or in 3D |
| **Export** | Keep a picture or the one-file offline page, download the graph, or download the package as a zip to unpack in your project |

Three things to know about where your work is:

- **Graphs are stored in your browser, on that device.** They are not copied anywhere. If you clear the site's data, they are gone, so download anything you care about.
- **The app never runs an agent** and never calls a model, any more than the command line does.
- **The app is for review.** The project's stated view is that most graphs are written by agents and that the app is where a person reads, adjusts and reuses them.

## Which should you use?

- To **try grooph for the first time**: the command line and chapter 4's three commands.
- To **use it for real work**: the design skill, and the compare view on your phone.
- To **read a graph someone sent you**: the app, from their link.
- To **see what a run did**: `grooph runs show`, or the app's run page.

The references for this chapter are [cli.md](../cli.md), [executive.md](../executive.md) and [privacy.md](../privacy.md).

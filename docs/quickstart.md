# Quickstart

grooph draws workflow diagrams: who does the work, who checks it, where a person decides, and when it stops. You can draw one in the app, start from a template, use the command line, or ask an agent to draw it. All four make the same small JSON document.

## In the app

Open [ryanjosephkamp.github.io/grooph](https://ryanjosephkamp.github.io/grooph/). There is nothing to install and no account, and your diagrams stay in this browser.

1. **New graph** opens an empty diagram. **Add** puts in a node (an agent, a human gate, a check, or a stop) or inserts a template. **Connect** draws an edge: tap the node it starts from, then the one it goes to. **Loop** starts a loop: tap its members, and tap an edge's label to mark the edge that goes back. An agent's panel has **Done by**, which makes it a person's step.
2. Tap a node to edit it in the panel beside the canvas. The badge in the top bar says whether the diagram is valid; tap it for each finding and how to fix it.
3. Switch between **Picture** and **3D** at the canvas's top right. In 3D, drag to turn it, use the slider to step through it one edge at a time, and press **Full screen** to watch it with nothing else on the screen.
4. **Export** has **Download graph** for the document itself and, under **Keep a copy**, a picture (PNG or SVG) or an offline page.

Or start from **Templates**: open one, then **Use this template** and fill in its blanks. Or press **Sketch it**, marked Experimental, and draw the diagram by hand: a shape for each step and arrows between them, then **Make it a graph**. Any graph can be drawn on the same way, under **Sketch**, beside Picture and 3D ([sketching it](exports.md#sketching-it)).

## With the command line

You need Node 22 or later.

```bash
npm install --global grooph
grooph template use grind-loop --name "Fix the flaky test" --set task="Make the checkout test pass ten times in a row." --set test-command="pnpm test checkout" --out flaky.grooph.json
grooph validate flaky.grooph.json
grooph image flaky.grooph.json --out flaky.png
grooph share flaky.grooph.json
```

1. `template use` makes a diagram from a template; `grooph template list` shows all twenty, and the four plans for people.
2. `validate` checks it. Each finding has a code and says what to fix; [rules.md](rules.md) lists every code with an example.
3. `image` draws it, as PNG or SVG.
4. `share` prints a link that opens it in the app, in 2D or 3D.

Most commands end with a `next:` line that says what to run after them. `grooph --help` lists every command, and `grooph help <command>` gives one in full.

## With an agent

In Claude Code, install the `grooph` command (above), then the plugin that adds the `grooph-design` skill:

```text
/plugin marketplace add ryanjosephkamp/grooph
/plugin install grooph@grooph
```

Then, in a session on your project, describe the work:

```text
/grooph:grooph-design a builder and a critic that loop until the checkout tests pass, and ask me before merging
```

The agent proposes one to three diagrams, gives you a link that compares them side by side on your phone, and on your pick saves the one you chose with its picture and a link. It starts no work. In a chat app with no coding session, see [Drawing with an agent](agents.md#from-a-chat-app).

From a clone, `scripts/install-local.sh` does the same job for your user. It links `grooph` into `~/.local/bin` and the skill into `~/.claude/skills/`, so the skill is `/grooph-design`. It prints what it will touch first, and `--uninstall` removes both links:

```bash
git clone https://github.com/ryanjosephkamp/grooph.git && cd grooph
pnpm install && pnpm -r build && scripts/install-local.sh
```

## Where next

- [Drawing with an agent](agents.md): what an agent reads to draw a diagram, and [the agents' reference](agents-reference.md): every change by example, and what to do about each rule.
- [Pictures, views, and sharing](exports.md): the picture, the 3D views, themes, links, embeds, and the offline page.
- [Templates](templates.md) and [the field guide](field-guide.md): the twenty shapes and how to save your own.
- [The graph document](graph-ir.md): every field and rule.
- [On any page](exports.md#on-any-page-without-an-iframe): one script tag draws a diagram into a page. In Obsidian, the [grooph plugin](https://community.obsidian.md/plugins/grooph) draws it in a note.

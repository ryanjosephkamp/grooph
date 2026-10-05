# 10 · Pictures, views and themes

[Start page](README.md) · previous: [operation maps](09-operation-maps.md) · next: [watching a run](11-watching-a-run.md)

A graph document is the truth, and it is not pleasant to read. So grooph can show it in several ways. Each way is a **view**: something made *from* the document. A view is never a second copy to keep in step. You change the document, and the views follow.

Almost all of these go in one direction only. You cannot edit a picture and have the graph change. The one place a graph is edited by hand is the canvas in the app ([chapter 12](12-command-line-and-app.md)).

## The picture

You have seen three already, in chapters 1, 8 and 9. The **picture** is the whole document with its words on it, laid out as one column narrow enough to read on a phone without zooming.

```bash
grooph image rounding.grooph.json --out rounding.png
```

```text
wrote rounding.png
```

How to read one:

- each node is a card, with its kind, its name, and one line about it;
- an arrow joins each card to the next, with its condition (`pass`, `fail`) in a small label;
- a loop's back edges run up the right-hand side, dashed, in the loop's color;
- under the cards, each loop is written out: its bar, and its stops in order.

The file can be a PNG (an ordinary image) or an SVG (a drawing that stays sharp at any size). The same document and the same theme always give the same SVG, down to the last character, so a picture can be kept in a repository and compared.

## Themes

The same picture has six looks, called **themes**. A theme changes colors, line weights, lettering and background. It never changes the words, the layout or the meaning.

| Theme | Meant for |
|---|---|
| `paper` | The default |
| `blueprint` | Architecture notes and slides: reads like an engineering drawing |
| `ink` | Papers and print: one ink, no tints, survives a photocopier |
| `phosphor` | Terminals and dark dashboards |
| `transit` | Talks and posters seen from across a room |
| `chalk` | Early drafts and teaching: hand lettering that says "this may still change" |

```bash
grooph image rounding.grooph.json --theme blueprint --out rounding-blueprint.png
```

```text
wrote rounding-blueprint.png
```

Each theme also comes in light and dark. See [themes.md](../themes.md) for a picture of each.

## The outline

The **outline** is the document as a page to read from top to bottom: every brief in full, every edge as a sentence, every loop with its bar and stops.

```bash
grooph outline rounding.grooph.json
```

```text
# Add a rounding helper

**Goal**

add a roundTo(value, places) helper with tests Done when every item in docs/REVIEW-CHECKLIST.md is shown to hold, `npm test` passes, and a human approves the merge.
…
**Shape:** 2 agents · 1 gate · 1 loop · up to 4 rounds · 10 dispatches

**Model tiers:** 2 strong

**Runs in:** claude-code

**If the graph turns out wrong:** adaptive: the lead may amend its working copy, visibly; brakes cannot be loosened

**Version:** add-a-rounding-helper@1

## Agent: Builder
…
```

This is the view to use when you want to *review* a graph: it hides nothing and needs no knowledge of JSON.

(The line "brakes cannot be loosened" is the outline restating the graph's rule. As chapter 7 explained, during a run that rule is an instruction to the lead.)

## The offline page

One HTML file that holds the picture, the outline, the validator's findings and the document itself.

```bash
grooph page rounding.grooph.json --out rounding.html
```

```text
wrote rounding.html (25 KB, one file, no network needed)
```

You can send that one file to anyone. It opens in a browser with no internet connection, and it is built so that it cannot ask the network for anything. It is for reading. Nothing in it edits.

## The glyph

The **glyph** is the small wordless drawing of a graph's shape. You saw one inside the subgrooph box in chapter 8. It is meant for lists, where there is no room for words: a square is a worker that writes, a diamond one that judges, a hexagon a check, an octagon a human gate, and an arc underneath is a back edge.

```bash
grooph glyph rounding.grooph.json --out rounding-glyph.svg
```

```text
wrote rounding-glyph.svg
```

The [field guide](../field-guide.md) shows the glyph of every template.

## Mermaid

**Mermaid** is a common text format for flowcharts that many websites can draw. grooph can write a graph in it:

```bash
grooph mermaid rounding.grooph.json
```

```text
%% grooph mermaid: a projection of Add a rounding helper (add-a-rounding-helper@1). One way only: it does not round-trip.
%% Loops, stops, bars and brakes live in the graph document; edit that, not this.
flowchart LR
  subgraph n_review["Review · judgment loop"]
    n_builder["Builder"]
    n_critic{"Critic"}
    n_merge_gate[/"Merge approval"\]
    n_review_stop_1>"stop: bar passed"]:::stop
    n_review_stop_2>"stop: max iterations: 4"]:::stop
    n_review_stop_3>"stop: budget: 10 dispatches"]:::stop
  end
  n_done((("Done")))
  n_builder --> n_critic
  n_critic -.->|"fail"| n_builder
  n_critic -->|"pass"| n_merge_gate
  n_merge_gate -->|"pass"| n_done
  n_merge_gate -.->|"fail"| n_builder
  classDef stop fill:none,stroke-dasharray:3 3,font-size:12px
```

Its own first lines say what to remember: it is one way only, and the brakes live in the document.

## Three dimensions

In the app, every screen that draws a graph has a switch at its top right: **Picture** and **3D**.

The 3D view arranges a graph as stacked sheets. **Each loop is a sheet**, with its members standing on it as cards. Whatever is in no loop stands on a first sheet called "Outside any loop". So the thing that repeats is shown as a *place*, and an arrow that leaves a sheet is an edge that enters or leaves a loop. You can turn the scene by dragging and move in and out by pinching.

Under it is a slider. It steps through the edges in the order a first pass would take them, and then through one turn of each loop. It says of itself that this is an order and not a clock, because a graph records no times. On the page of a **recorded run**, the slider replays the run's own notes instead, lighting each card, arrow or sheet as the run reached it.

An operation map has the same 3D view, with a sheet for each lane, and two more flat ones: its lanes side by side, for a wide screen, and a **sequence**, with one row for each handoff.

The 3D views exist only in the app. `grooph image` always draws a flat picture.

## Sharing and embedding

Two more commands put a graph in front of someone else. `grooph share` makes a link that opens the graph in the app, with the whole document carried inside the link itself, so nothing is uploaded anywhere. `grooph embed` prints one line of HTML that shows a read-only picture of a graph inside another web page. Chapter 12 returns to both.

The reference for this chapter is [exports.md](../exports.md).

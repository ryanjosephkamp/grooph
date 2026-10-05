# 9 · Operation maps

[Start page](README.md) · previous: [subgroophs](08-subgroophs.md) · next: [pictures, views and themes](10-pictures-and-views.md)

Everything so far has been about **one session**: a lead and the subagents it starts. A graph is exactly that and no more.

Some work is bigger than one session. One session plans, another builds on a different computer, a third reviews under a different account, and a person carries things between them. A graph cannot describe that, and grooph does not pretend it can. There is a second kind of document for it: the **operation map**.

The difference to remember: **a graph is compiled into instructions. A map is only drawn and checked.** Nothing reads a map while work is going on. It is a picture of how an operation is arranged, so that the people in it can see the arrangement and its weak points.

## What is on a map

A map's file name ends in `.grooph-map.json`. It has four kinds of thing.

| Thing | What it is |
|---|---|
| **Lane** | One machine under one account. Sessions in the same lane can reach each other directly |
| **Session** | One harness session, or several alike drawn as one with a count. What happens inside it is a graph's business |
| **Person** | Someone the sessions work with |
| **Handoff** | Work passing from one session or person to another, in one direction, by a named carrier |

A **carrier** is what actually moves the work across: a branch, a pull request, a message between sessions, a scheduled message, a review page, a notification, or a person. Work that goes out and comes back is two handoffs, usually by two different carriers.

## A small one

The repository has a sample, `fixtures/maps/valid/a-person-and-two-sessions.grooph-map.json`. Copied into the scratch folder as `team.grooph-map.json`, it draws like this:

![An operation map. At the top a person, "The owner". Below, a lane called "Laptop" holding two session cards, "Lead" and "Worker". Numbered arrows in the right margin join them, and the five handoffs are listed underneath.](team.svg)

One person, one lane, two sessions, five handoffs. The owner asks the lead for something (1). The lead hands a piece to a worker (2). The worker hands it back on a branch (3). The lead wakes itself every hour to check in (4). The lead tells the owner when it is done (5).

## Checking a map

The same `validate` command checks maps.

```bash
grooph validate team.grooph-map.json
```

```text
a-person-and-two-sessions: 1 lane · 2 sessions · 1 person · 5 handoffs, 1 waiting on a person
team.grooph-map.json: no issues
by hand  h-ask  owner → lead: moves only when The owner does it
```

Look at the last line. It is not an error and not a warning. It is something grooph says every time it checks a map: **this handoff moves only when a person does it.** A handoff that waits on a person is a true fact about an operation, so it is allowed. It is also exactly where work stalls when that person is busy, so it is always pointed out.

A map has a few rules of its own, in the same style as a graph's:

| Code | In plain words |
|---|---|
| `E_HANDOFF_NO_CARRIER` | A handoff does not say what carries it. "Somehow" is not a carrier |
| `W_CARRIER_CANNOT_CROSS` | The carrier cannot get from one end to the other: a session message between two different accounts, for instance |
| `W_NOTIFY_NOT_PERSON` | A notification is addressed to a session. Notifications reach people |
| `W_SESSION_ISLAND` | A session or a person that nothing reaches and that reaches nothing |
| `W_NO_RETURN` | A session receives work and hands nothing on |
| `W_GRAPH_UNRESOLVED` | A session points at a graph file that could not be found |

## A map is never compiled

```bash
grooph export team.grooph-map.json --target claude-code --into .
```

```text
grooph: cannot export team.grooph-map.json: it is an operation map, and a map is never compiled or run. Export the loop graph one of its sessions points at; draw the map with `grooph image team.grooph-map.json` or share it with `grooph share team.grooph-map.json`.
```

It is refused by name. There is no package for a map and nothing to run.

## What a map is good for

- **Seeing where a person is the carrier.** Those are the slow places.
- **Seeing a carrier that cannot work.** A message cannot cross from one account to another.
- **Explaining an operation to someone new**, in one picture.

A map can also be drawn with its lanes side by side on a wide screen, as a sequence with one row per handoff, and, in the app only, in three dimensions with a slider that steps through the handoffs in order. Chapter 10 covers the views. Combined with the event hook of chapter 11, a map can also mark which of its sessions are at work right now.

A map is a snapshot of one day. A map that is out of date is simply wrong, and harmless, because nothing depends on it.

The reference for this chapter is [operation-map.md](../operation-map.md).

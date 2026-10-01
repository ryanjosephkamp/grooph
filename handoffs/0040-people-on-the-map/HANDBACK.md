# Handback 0040 · People on the map; a session that wakes itself; version 0.2.0

**Branch:** `slice/0040-people-on-the-map` (stacked on 0039) · **Date:** 2026-10-01 · **By:** the operator-round session (Opus 5.5) · **Spend:** none

The Operator: the owner is the hub of the operation and cannot be drawn; there is no carrier for a notification to a person; a session that wakes itself on a schedule deserves a mark.

## What changed

- **Amendment A-013**, written first: a map may name `people`; a handoff may start or end at one; `notification` is a carrier. Additive within `groophMap: 0`: every 0.1.0 map loads and validates as before.
- **Core.** `Person` and `people` in the types and the schema (the published schema regenerated). The validator: a person's id is an id like any other; a handoff's end is a session or a person; a `person` carrier needs no `who` when the handoff starts at a person; one new rule, `W_NOTIFY_NOT_PERSON`, with a failing fixture; a person nothing touches is `W_SESSION_ISLAND`. What starts with a person is listed with what a person carries ("moves only when Ryan does it"). The shape line says "1 person" and "waiting on a person" only for a map that draws one.
- **The picture.** People in a band above the lanes; a notification as a line of dots; a dotted ring and the schedule on the card of a session that sends itself a scheduled message. The outline says the same in words.
- **The app.** A person on the map opens what the map says about them and the handoffs that start and end with them.
- **Fixtures.** The smallest map with a person; the owner's operation redrawn with its owner as a person (a sketch for the Operator to correct); pictures of both.
- **Version 0.2.0.**

## Verified

| Claim | How | Result |
|---|---|---|
| The rules for people, each edge named in `docs/operation-map.md` §3 | `pnpm --filter @grooph/core test` | 333 pass |
| A map written before people existed is unchanged | the same suite: its shape line, its canonical form; `golden:write` leaves the first draft's picture byte-identical | passes |
| The picture and the outline | the same suite; both example maps drawn and looked at | passes |
| In a browser | `npx playwright test e2e/map.spec.ts`: a person opens, leads to a handoff and back; a session says how it wakes itself | 7 pass |
| Everything | `pnpm -r test`, Playwright, `scripts/test-install-local.sh` | core 333, cli 86, web 58; 90 browser; the install check passes at 0.2.0 |

## An independent read

The same reviewer read the validator and the picture. Maps without people behave exactly as before; card heights always hold what is drawn in them. It found, and these are fixed with tests: a person handing something to themselves validated clean and hid that the person was an island; and the cards' share of the lane was not a true floor, so a hub with fifty handoffs drew cards of negative width. A card is now never narrower than 120 units, whatever the count.

## Not verified

- The redrawn operation is the grooph session's reading of the Operator's answers, not the Operator's own drawing.
- A map with many people: the band stacks them one per row.

## Decisions made here

- **A person is optional, and the `person` carrier stays.** A small map is still clearer saying "carried by Ryan" on one line than drawing a man and two more handoffs.
- **No lane for a person.** A person is on no machine and under no account; the band says so by sitting outside the lanes.
- **The self-wake mark is a drawing, not a field.** The document already says it: a scheduled message from a session to itself.

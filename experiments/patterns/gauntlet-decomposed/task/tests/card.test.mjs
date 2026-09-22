import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { renderCard, WIDTH, HEIGHT } from "../src/card.mjs";

const data = JSON.parse(readFileSync(new URL("../data/summary.json", import.meta.url), "utf8"));

test("the card is a well-formed 640 × 360 SVG with a header and a trend group", () => {
  const svg = renderCard(data);
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="640" height="360"/);
  assert.equal(WIDTH, 640);
  assert.equal(HEIGHT, 360);
  assert.ok(svg.includes('<g id="header">') && svg.includes('<g id="trend">'));
  assert.ok(svg.trimEnd().endsWith("</svg>"));
});

test("every stat and every month appears", () => {
  const svg = renderCard(data);
  for (const stat of data.stats) assert.ok(svg.includes(stat.label), `${stat.label} is shown`);
  assert.equal((svg.match(/<rect\b/g) ?? []).length >= data.monthly.length, true, "one bar per month at least");
});

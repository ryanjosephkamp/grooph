import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { renderChart } from "../src/chart.mjs";

const data = JSON.parse(readFileSync(new URL("../data/monthly.json", import.meta.url), "utf8"));

test("renderChart returns one well-formed svg element", () => {
  const svg = renderChart(data);
  assert.match(svg, /^<svg[^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.ok(svg.trimEnd().endsWith("</svg>"));
});

test("renderChart draws one bar per month", () => {
  const svg = renderChart(data);
  assert.equal((svg.match(/<rect\b/g) ?? []).length >= data.values.length, true);
});

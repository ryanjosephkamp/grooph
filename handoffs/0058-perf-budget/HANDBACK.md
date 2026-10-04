# Handback 0058 · A performance budget

**Branch:** `slice/0058-perf-budget` (from `main`) · **Date:** 2026-10-04 · **By:** the driver session (Opus 5.5) · **Spend:** none

The owner asked for the site and the app to be built out and polished overnight "without hurting grooph performance". That needs a number that fails when speed is spent, so this came first.

## What changed

- `scripts/perf-budget.mjs`: prints, and with `--check` enforces, the gzip weight of the app's first load (HTML, scripts, styles) and the CLI's cold start, against `scripts/perf-budget.json`.
- It is extended in slice 0066 to weigh each route once the embed split the bundle.

## The baseline, on `main` at 0.2.5

| | `main` |
|---|---|
| The app's first load | 267.9 KB (scripts 254.6, styles 12.8, HTML 0.8) |
| The CLI's cold start | 92 ms |

## Not done

Not yet a CI step: `.github/workflows/ci.yml` was owned by lane 0057 when this was written. The driver adds the step when the lanes have merged.

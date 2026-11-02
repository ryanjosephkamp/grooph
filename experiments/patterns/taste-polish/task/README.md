# revenue-chart

Renders the monthly revenue chart that goes into the printed quarterly report.

```bash
npm run render     # writes out/chart.svg from data/monthly.json via src/chart.mjs
npm run capture    # renders, then copies the SVG into captures/ with a readable summary
npm test           # the SVG is well-formed and shows every month
```

`src/chart.mjs` exports `renderChart(data)` and returns the SVG as a string;
`scripts/render.mjs` writes it to `out/chart.svg`. `STYLE.md` says what the
chart should look like. The chart is judged from the files in `captures/`.

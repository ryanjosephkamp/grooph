/**
 * The summary card: a fixed 640 × 360 SVG that composes the header and the
 * trend. The pieces are the two modules; this file only frames them.
 */
import { renderHeader } from "./header.mjs";
import { renderTrend } from "./trend.mjs";

export const WIDTH = 640;
export const HEIGHT = 360;

export function renderCard(data) {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" font-family="Inter, Helvetica, Arial, sans-serif">`,
    `<g id="header">${renderHeader(data)}</g>`,
    `<g id="trend">${renderTrend(data)}</g>`,
    `</svg>`,
    ``,
  ].join("\n");
}

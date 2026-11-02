/**
 * The card's trend: one bar per month of the period. Returns SVG fragments
 * positioned inside the card.
 */
export function renderTrend(data) {
  const max = Math.max(...data.monthly);
  return data.monthly
    .map((value, i) => {
      const h = (value / max) * 100;
      return `<rect x="${10 + i * 20}" y="${340 - h}" width="18" height="${h}" fill="black"/>`;
    })
    .join("");
}

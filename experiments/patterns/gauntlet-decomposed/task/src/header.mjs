/**
 * The card's header: the title, the period, and one tile per headline stat.
 * Returns SVG fragments positioned inside the card.
 */
export function renderHeader(data) {
  const lines = [`<text x="10" y="20" font-size="16">${data.title}</text>`, `<text x="10" y="36" font-size="12">${data.period}</text>`];
  data.stats.forEach((stat, i) => {
    lines.push(`<text x="10" y="${60 + i * 16}" font-size="12">${stat.label}: ${stat.value} (${stat.delta})</text>`);
  });
  return lines.join("");
}

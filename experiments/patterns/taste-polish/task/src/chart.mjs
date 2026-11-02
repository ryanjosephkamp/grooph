/**
 * Renders the monthly revenue bar chart as an SVG string.
 * @param {{ title: string, unit: string, months: string[], values: number[] }} data
 */
export function renderChart(data) {
  const width = 600;
  const height = 300;
  const max = Math.max(...data.values);
  const barWidth = width / data.values.length;
  const bars = data.values
    .map((value, i) => {
      const h = (value / max) * height;
      const x = i * barWidth;
      const y = height - h;
      return `<rect x="${x}" y="${y}" width="${barWidth}" height="${h}" fill="black"/>` + `<text x="${x + 2}" y="${height - 4}" font-size="10" fill="white">${i + 1}</text>` + `<text x="${x + 2}" y="${y - 2}" font-size="9">${value}</text>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${bars}</svg>\n`;
}

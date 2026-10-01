/**
 * A recording moved in time. The fixtures under fixtures/events/ were recorded on a day that is now long past,
 * and a session caught mid-flight is only "working" while its last line is fresh: half an hour on, a view says
 * when it was last seen instead (QUIET_AFTER_SECONDS in core). A test that means "a session running now" moves
 * the recording so that its last line is a minute before `now`.
 */
export function moved(text: string, now: number, ago = 60_000): string {
  const lines = text.split("\n").filter((line) => line.trim() !== "");
  const times = lines.map((line) => Date.parse((JSON.parse(line) as { t: string }).t));
  const shift = now - ago - Math.max(...times);
  return `${lines.map((line, i) => JSON.stringify({ ...(JSON.parse(line) as Record<string, unknown>), t: new Date(times[i]! + shift).toISOString() })).join("\n")}\n`;
}

/**
 * `#/embed?d=<payload>[&theme=<name>][&frame=1][&play=1][&c=<candidate>]`
 * (docs/exports.md, "Embedding"). `theme` is light or dark, one of the picture's six themes (docs/themes.md), or
 * both as `chalk-dark`; the theme itself is read by `doc/look.ts`. The payload is an ordinary share payload,
 * the one `#/open?d=` carries, so a link and an embed of the same document
 * hold the same bytes. `run=<payload>` is the same as `d=` for a run.
 */

export type EmbedTheme = "light" | "dark";

export type EmbedLink = {
  payload: string;
  /** absent: follow the reader's color scheme */
  theme?: EmbedTheme;
  /** draw the embed's own background and border, instead of the host page's background */
  frame: boolean;
  /** start a run's replay as soon as it opens (not under reduced motion) */
  play: boolean;
  /** for a proposal set: the candidate to show, by id */
  candidate?: string;
  /** one of the picture's themes, as the address names it; `doc/look.ts` decides what it means */
  look?: string;
};

const decode = (raw: string): string => {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
};

/** What an embed hash asks for. Unknown parameters are ignored, so a newer link still opens. */
export function parseEmbedHash(hash: string): EmbedLink {
  const query = hash.includes("?") ? hash.slice(hash.indexOf("?") + 1) : "";
  const params = new Map<string, string>();
  for (const pair of query.split("&")) {
    if (pair === "") continue;
    const eq = pair.indexOf("=");
    const key = eq < 0 ? pair : pair.slice(0, eq);
    if (!params.has(key)) params.set(key, eq < 0 ? "" : pair.slice(eq + 1));
  }
  // Light or dark, alone or after a theme's name: `dark`, `chalk-dark`.
  const theme = /(?:^|-)(light|dark)$/.exec(params.get("theme") ?? "")?.[1];
  const look = /^([a-z]+?)(?:-(?:light|dark|auto))?$/.exec(params.get("theme") ?? "")?.[1];
  const candidate = params.get("c");
  return {
    payload: params.get("d") ?? params.get("run") ?? "",
    ...(theme === "light" || theme === "dark" ? { theme } : {}),
    frame: params.get("frame") === "1",
    play: params.get("play") === "1",
    ...(candidate ? { candidate: decode(candidate) } : {}),
    ...(look && !["light", "dark", "auto"].includes(look) ? { look } : {}),
  };
}

export const isEmbedHash = (hash: string): boolean => hash === "#/embed" || hash.startsWith("#/embed?");

/** The full app with the same payload, for "Open in grooph": the page this app is served from, at `#/open`. */
export function openInAppHref(link: EmbedLink, page: string = location.href): string {
  const root = page.split("#")[0]!;
  return `${root}#/open?d=${link.payload}${link.candidate ? `&c=${encodeURIComponent(link.candidate)}` : ""}${link.look ? `&theme=${link.look}` : ""}`;
}

/**
 * The picture's theme in the app (handoff 0086; docs/themes.md): which of the six a person chose, kept in this
 * browser as the site's look is, and the chosen theme's values once they are here.
 *
 * Paper, the picture as it has always been, needs nothing: this file is all an address carries for it. The other
 * five are a piece of the app of their own (`ui/theme/themes.ts`), fetched when one is first chosen or when an
 * address names one, and held by the service worker from the first visit. Until the piece arrives, and if it
 * cannot be fetched, every picture is Paper.
 *
 * The choice is separate from the site's look (the header's Grooph and Meteor) and from light and dark: a theme has
 * its own colors for each, and follows the device as Paper does.
 */
import type { PictureLook } from "@grooph/core/themes";
import { useEffect, useSyncExternalStore } from "react";

/** The six, in the order they are offered: its name in an address, its name to a person, and its swatch in a menu. */
export const LOOKS = [
  ["paper", "Paper", "#1f5f4a"],
  ["blueprint", "Blueprint", "#24467e"],
  ["ink", "Ink", "#1c1c1c"],
  ["phosphor", "Phosphor", "#5dff8a"],
  ["transit", "Transit", "#0057b8"],
  ["chalk", "Chalk", "#a94e08"],
] as const;
export type LookId = (typeof LOOKS)[number][0];

/** Where the choice is kept. */
const KEY = "groophPicture";

const known = (value: string | null | undefined): LookId | undefined => LOOKS.find(([id]) => id === value)?.[0];

type Piece = typeof import("../ui/theme/themes.js");
let piece: Piece | undefined;
let asked = false;
let chosen: LookId = (() => {
  try {
    return known(localStorage.getItem(KEY)) ?? "paper";
  } catch {
    return "paper";
  }
})();

const watchers = new Set<() => void>();
const tell = (): void => watchers.forEach((watcher) => watcher());
const watch = (watcher: () => void): (() => void) => {
  watchers.add(watcher);
  window.addEventListener("hashchange", watcher);
  return () => {
    watchers.delete(watcher);
    window.removeEventListener("hashchange", watcher);
  };
};

/**
 * The theme an address names: `theme=` on a share link or an embed, a name with `-light` or `-dark` after it or
 * without. A name that is none of the six is Paper. Undefined when the address names no theme: `theme=dark` alone
 * is an embed's light or dark, as it always was.
 */
export function lookNamed(hash: string): LookId | undefined {
  const value = /^#\/(?:open|embed)\?(?:[^#]*&)?theme=([^&]*)/.exec(hash)?.[1];
  if (value === undefined || value === "light" || value === "dark") return undefined;
  return known(value.replace(/-(?:light|dark)$/, "")) ?? "paper";
}

/** The theme in effect here: the one the address names; else the one chosen, except in an embed, which is somebody else's page. */
export const lookNow = (hash: string = location.hash): LookId => lookNamed(hash) ?? (hash.startsWith("#/embed") ? "paper" : chosen);

/** Choose a theme for the pictures, and keep the choice in this browser. */
export function chooseLook(id: LookId): void {
  chosen = id;
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* shown, not kept */
  }
  // A theme named in the address would bring the old one back on the next load. Only the part after the # is
  // touched: a ?theme= before it is the site's look.
  if (lookNamed(location.hash) !== undefined) {
    const hash = location.hash.replace(/([?&])theme=[^&]*(&|$)/, (_, before: string, after: string) => (after ? before : ""));
    history.replaceState(history.state, "", `${location.pathname}${location.search}${hash}`);
  }
  tell();
}

function fetchPiece(): void {
  if (asked) return;
  asked = true;
  import("../ui/theme/themes.js").then(
    (m) => {
      piece = m;
      tell();
    },
    // Not fetched (no network, and a first visit that the worker had not finished): the pictures stay Paper, and
    // the next choice asks again.
    () => void (asked = false),
  );
}

/** The theme in effect, for a menu to mark. */
export const useLookId = (): LookId => useSyncExternalStore(watch, lookNow);

/**
 * What to hand a picture so it is drawn in the theme in effect: `picture(doc, { ...(look ? { look } : {}) })`.
 * Undefined for Paper, and for another theme until its values are here.
 */
export function useLook(): PictureLook | undefined {
  const id = useSyncExternalStore(watch, () => `${lookNow()} ${piece ? 1 : 0}`).split(" ")[0] as LookId;
  useEffect(() => {
    if (id !== "paper") fetchPiece();
  }, [id]);
  return id === "paper" ? undefined : piece?.look(id);
}

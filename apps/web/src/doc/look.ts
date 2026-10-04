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

import { piece as fetched } from "../piece.js";

const IDS = ["paper", "blueprint", "ink", "phosphor", "transit", "chalk"] as const;
export type LookId = (typeof IDS)[number];
/** Each one's swatch in a menu, in the same order. */
const DOTS = ["#1f5f4a", "#24467e", "#1c1c1c", "#5dff8a", "#0057b8", "#a94e08"];
/** The six, in the order they are offered: its name in an address, its name to a person (the same word), and its swatch. */
export const LOOKS: readonly (readonly [LookId, string, string])[] = IDS.map((id, i) => [id, id[0]!.toUpperCase() + id.slice(1), DOTS[i]!]);

/** Where the choice is kept. */
const KEY = "groophPicture";

const known = (value: string | null | undefined): LookId | undefined => IDS.find((id) => id === value);

type Piece = typeof import("../ui/theme/themes.js");
let piece: Piece | undefined;
let asked = false;
/** The piece was asked for and could not be had: no network, and nothing kept. */
let missing = false;
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
 * The theme an address names: the first `theme=` on a share link or an embed, a name alone or with `-light`,
 * `-dark` or `-auto` after it, as `--theme` takes it. A name that is none of the six is Paper. Undefined when the
 * address names no theme: `theme=dark` alone is an embed's light or dark, as it always was.
 */
export function lookNamed(hash: string): LookId | undefined {
  const value = /^#\/(?:open|embed)\?(?:[^&]*&)*?theme=([^&]*)/.exec(hash)?.[1]?.replace(/-?(?:light|dark|auto)$/, "");
  return value ? (known(value) ?? "paper") : undefined;
}

/** The theme in effect here: the one the address names; else the one chosen, except in an embed, which is somebody else's page. */
export const lookNow = (hash: string = location.hash): LookId => lookNamed(hash) ?? (hash.startsWith("#/embed") ? "paper" : chosen);

/** An address without the theme it names: every `theme=` goes, and the rest stays as it was. */
export const withoutLook = (hash: string): string => (lookNamed(hash) === undefined ? hash : hash.replace(/([?&])theme=[^&]*&?/g, "$1").replace(/[?&]$/, ""));

function fetchPiece(): void {
  if (asked) return;
  asked = true;
  // A fetch that fails is tried again there and then, in a way every engine honors (`piece.ts`).
  fetched("themes", () => import("../ui/theme/themes.js")).then(
    (m) => {
      piece = m;
      missing = false;
      tell();
    },
    // Not to be had: no network, and a first visit the worker had not finished. The pictures stay Paper, whoever
    // waits on the theme is told, and the next choice asks afresh.
    () => {
      asked = false;
      missing = true;
      tell();
    },
  );
}

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
  const hash = withoutLook(location.hash);
  if (hash !== location.hash) history.replaceState(history.state, "", `${location.pathname}${location.search}${hash}`);
  // Choosing again is how a person asks again for a theme that could not be fetched: the connection may be back.
  if (id !== "paper" && !piece) fetchPiece();
  tell();
}

/** The theme in effect, for a menu to mark. */
export const useLookId = (): LookId => useSyncExternalStore(watch, lookNow);

/** Whether the theme in effect could not be fetched, so that what waits on it can stop waiting and say so. */
export const useLookMissing = (): boolean => useSyncExternalStore(watch, () => missing && !piece && lookNow() !== "paper");

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

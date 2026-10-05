/**
 * The pictures' themes (handoff 0086; docs/themes.md), as much of them as the app carries before one is wanted: a
 * look at what was kept and at the address, and an ear for a press on anything that offers them.
 *
 * Paper is the picture as it has always been, and needs none of this. The other five, the list of them, the choice
 * and every way a screen takes a theme are one piece of the app (`ui/theme/themes.ts`), fetched when a theme other
 * than Paper was kept in this browser or is named in the address, or when a person presses a control marked
 * `data-pictures` (the entry in the header's theme menu, the dot on the canvas, the button in Keep a copy). Until
 * then no code of the themes runs, and every picture is Paper.
 *
 * This file is not in the app's first load either: it comes with the screens that draw on the canvas
 * (`ui/screens.ts`), which an address that needs them loads at once and every other address fetches as soon as its
 * first screen is up. The first load holds one thing of the themes, the entry in the header's menu.
 */
import { piece } from "../piece.js";

/** The piece, asked for as every piece is: tried again if it fails, held by the service worker from the first visit. */
export const themes = (): Promise<typeof import("../ui/theme/themes.js")> => piece("themes", () => import("../ui/theme/themes.js"));

const FIVE = "(?:blueprint|ink|phosphor|transit|chalk)";
const NAMED = new RegExp(`^#/open\\?(?:[^&]*&)*?theme=${FIVE}(?:-(?:light|dark|auto))?(?:&|$)`);
const KEPT = new RegExp(`^${FIVE}$`);

/**
 * Whether this address may be drawn in a theme other than Paper: one of the five is named in a share link's
 * address, or one was kept here. Paper by name, a name that is none of the six and a kept value that is no theme
 * are Paper, and fetch nothing. Which theme is in effect is the piece's to say: an address may name Paper over a
 * kept theme. An embed asks for itself (`ui/embed/EmbedApp.tsx`).
 */
export function wanted(): boolean {
  if (NAMED.test(location.hash)) return true;
  try {
    return KEPT.test(localStorage.getItem("groophPicture") ?? "");
  } catch {
    return false;
  }
}

/**
 * Open the themes' list at a control that offers them. The piece may take a moment to come the first time: its
 * list then opens only if the person is still where they pressed, and does not take the keyboard from whatever
 * they have gone on to. If the piece cannot be had (no network, on a visit before the worker has it), that is said
 * beside the control, in words, for a few seconds: on a phone there is nothing to hover over.
 */
function offer(at: Element): void {
  at.removeAttribute("data-pressed");
  const host = (at.closest(".site-theme") ?? at.parentElement) as HTMLElement;
  host.querySelector("[data-no-themes]")?.remove();
  const here = document.activeElement;
  const still = (): boolean => at.isConnected && (document.activeElement === here || document.activeElement === document.body);
  themes().then(
    (fetched) => {
      if (still()) fetched.open(at);
    },
    () => {
      if (!at.isConnected) return;
      // In the place the list would have opened, and drawn as it would have been.
      const note = document.createElement("p");
      note.className = "site-theme-list";
      note.setAttribute("role", "status");
      note.setAttribute("data-no-themes", "");
      note.style.padding = "12px 14px";
      note.textContent = "The picture themes could not be fetched. They need a connection the first time.";
      host.append(note);
      setTimeout(() => note.remove(), 6000);
      // The header's entry closed its menu when it was pressed: the keyboard goes back to that menu's button.
      if (still()) host.querySelector<HTMLElement>(".site-theme-toggle")?.focus();
    },
  );
}

addEventListener("hashchange", () => {
  if (wanted()) themes().catch(() => undefined);
});
addEventListener("click", (e) => {
  const at = (e.target as Element | null)?.closest?.("[data-pictures]");
  if (at) offer(at);
});
// The header's entry may have been pressed before this file arrived: it says so, and is answered now.
const early = document.querySelector("[data-pressed]");
if (early) offer(early);

// A screen that is to be drawn in a theme is not shown in Paper first: its picture is held back, a moment and no
// longer, until the themes are here and have dressed it. This file comes with the screens, so the rule is in the
// page before any of them draws. With nothing kept and nothing named there is nothing to hold.
if (wanted()) {
  const held = document.createElement("style");
  held.textContent = "main.stage,.map-picture{visibility:hidden}";
  document.head.append(held);
  const shown = (): void => held.remove();
  themes().then(shown, shown);
  setTimeout(shown, 800);
}

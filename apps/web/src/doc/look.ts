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

/**
 * Whether this address is to be drawn in a theme other than Paper: one is named in a share link's address (a theme's
 * name begins with one of five letters; `light` and `dark` do not), or one was kept here. Which theme, and what a
 * name means, is the piece's to say. An embed asks for itself (`ui/embed/EmbedApp.tsx`).
 */
export function wanted(): boolean {
  if (/^#\/open\?.*theme=[bcipt]/.test(location.hash)) return true;
  try {
    return (localStorage.getItem("groophPicture") ?? "paper") !== "paper";
  } catch {
    return false;
  }
}

/** Open the themes' list at a control that offers them. If they cannot be had, the control says what it needs. */
function offer(at: Element): void {
  at.removeAttribute("data-pressed");
  themes().then(
    (fetched) => fetched.open(at),
    () => at.setAttribute("title", "Needs a connection the first time"),
  );
}

const begin = (): void => {
  if (wanted()) themes().catch(() => undefined);
};
begin();
addEventListener("hashchange", begin);
addEventListener("click", (e) => {
  const at = (e.target as Element | null)?.closest?.("[data-pictures]");
  if (at) offer(at);
});
// The header's entry may have been pressed before this file arrived: it says so, and is answered now.
const early = document.querySelector("[data-pressed]");
if (early) offer(early);

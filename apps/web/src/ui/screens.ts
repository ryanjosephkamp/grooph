/**
 * The screens that draw on the canvas, as one module the app fetches when an address first needs one (slice 0069).
 *
 * The front page, the library and the template list do not draw on it, and the canvas library is over half the
 * app's script. So they load without it; `index.html` asks for this module beside the app when the address opens
 * on one of these screens, and the app fetches it once its first screen is up otherwise.
 */
// The pictures' themes begin here and not in the first load: a look at what was kept and at the address (slice 0086).
import "../doc/look.js";

export { EditorScreen } from "./Editor.js";
export { LiveSessions } from "./live/LiveSessions.js";
export { OpenScreen } from "./open/OpenScreen.js";
export { LiveRun, StoredRun } from "./run/RunScreens.js";
export { TemplateView } from "./templates/TemplateView.js";
export { UseTemplate } from "./templates/UseTemplate.js";

import type { Profile } from "@grooph/core";

import { PROFILE_LEVEL, PROFILE_TEXT } from "../../doc/templates.js";

/** Cost, speed and rigor as three chips with a small meter each: the coarse profile of docs/templates.md §1. */
export function ProfileChips({ profile, className = "ccard-profile" }: { profile: Profile; className?: string }) {
  return (
    <ul className={className} aria-label="Profile">
      {(["cost", "speed", "rigor"] as const).map((k) => (
        <li key={k} className="pchip">
          <span className="meter" aria-hidden="true" data-level={PROFILE_LEVEL[k][profile[k] as never]}>
            <i />
            <i />
            <i />
          </span>
          {PROFILE_TEXT[k][profile[k] as never]}
        </li>
      ))}
    </ul>
  );
}

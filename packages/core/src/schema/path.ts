import { fileURLToPath } from "node:url";

/** Absolute path of the published schema; Node-only, not part of the browser API. */
export const SCHEMA_PATH = fileURLToPath(
  new URL("../../../schema/grooph-0.schema.json", import.meta.url),
);

/** Absolute path of the published proposal set schema (docs/executive.md §1). */
export const PROPOSALS_SCHEMA_PATH = fileURLToPath(
  new URL("../../../schema/grooph-proposals-0.schema.json", import.meta.url),
);

/** Absolute path of the published run bundle schema (docs/runs.md §2). */
export const RUN_SCHEMA_PATH = fileURLToPath(
  new URL("../../../schema/grooph-run-0.schema.json", import.meta.url),
);

/** Absolute path of the published operation map schema (docs/operation-map.md §1). */
export const MAP_SCHEMA_PATH = fileURLToPath(
  new URL("../../../schema/grooph-map-0.schema.json", import.meta.url),
);

import { fileURLToPath } from "node:url";

/** Absolute path of the published schema; Node-only, not part of the browser API. */
export const SCHEMA_PATH = fileURLToPath(
  new URL("../../../schema/grooph-0.schema.json", import.meta.url),
);

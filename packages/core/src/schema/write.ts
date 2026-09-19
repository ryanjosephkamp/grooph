/**
 * Regenerate the published JSON Schemas from `graph.ts` and `proposals.ts`.
 *
 *   pnpm --filter @grooph/core run schema:write
 *
 * `test/schema.test.ts` and `test/proposals.test.ts` fail when a committed file
 * and this output differ, so the schemas can never drift away from the types.
 */

import { writeFileSync } from "node:fs";
import { graphJsonSchema } from "./graph.js";
import { PROPOSALS_SCHEMA_PATH, SCHEMA_PATH } from "./path.js";
import { proposalsJsonSchema } from "./proposals.js";

writeFileSync(SCHEMA_PATH, graphJsonSchema(), "utf8");
process.stdout.write(`wrote ${SCHEMA_PATH}\n`);
writeFileSync(PROPOSALS_SCHEMA_PATH, proposalsJsonSchema(), "utf8");
process.stdout.write(`wrote ${PROPOSALS_SCHEMA_PATH}\n`);

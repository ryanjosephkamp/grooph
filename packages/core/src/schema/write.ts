/**
 * Regenerate the published JSON Schema from `graph.ts`.
 *
 *   pnpm --filter @grooph/core run schema:write
 *
 * `test/schema.test.ts` fails when the committed file and this output differ,
 * so the schema can never drift away from the types.
 */

import { writeFileSync } from "node:fs";
import { graphJsonSchema } from "./graph.js";
import { SCHEMA_PATH } from "./path.js";

writeFileSync(SCHEMA_PATH, graphJsonSchema(), "utf8");
process.stdout.write(`wrote ${SCHEMA_PATH}\n`);

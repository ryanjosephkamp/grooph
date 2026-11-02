/**
 * The command as a program: what a bundle starts from (the npm package, the chat skill's
 * script, the desktop extension). From the clone, bin/grooph.js does the same.
 */

import { run } from "./index.js";

// A reader that stops early (`grooph template list | head -3`) closes the pipe: that is the end of the output, not a crash.
process.stdout.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EPIPE") process.exit(0);
  throw err;
});

process.exitCode = await run(process.argv.slice(2));

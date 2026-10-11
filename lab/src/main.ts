/**
 * The lab's command as a program: what `lab/bin/grooph-lab.js` starts. It is run from the clone and from nowhere
 * else: no bundle is made of it, and no package holds it.
 */

import { run } from "./index.js";

// A reader that stops early (`grooph-lab runs list | head -3`) closes the pipe: that is the end of the output, not a crash.
process.stdout.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EPIPE") process.exit(0);
  throw err;
});

process.exitCode = await run(process.argv.slice(2));

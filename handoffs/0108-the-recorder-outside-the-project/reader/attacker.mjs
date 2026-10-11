/**
 * The other side of a race (race.mjs starts it): one thing done and undone in a loop until it is told to stop.
 * It is given one JSON argument and touches only the paths in it, which race.mjs made under its scratch folder.
 */
import { closeSync, constants, linkSync, lstatSync, openSync, readSync, renameSync, rmSync, symlinkSync, unlinkSync } from "node:fs";

const a = JSON.parse(process.argv[2]);
let rounds = 0;
let pipeBytes = 0;
let stop = false;
process.on("SIGTERM", () => (stop = true));
const quiet = (fn) => {
  try {
    fn();
    return true;
  } catch {
    return false;
  }
};

let fd;
if (a.kind === "pipe") fd = openSync(a.fifo, constants.O_RDONLY | constants.O_NONBLOCK);
const buf = Buffer.alloc(65536);
let strays = 0;

function round() {
  if (a.kind === "dir") {
    // The folder away, a link in its place; then the link off and the folder back.
    const kept = `${a.target}.real`;
    if (quiet(() => renameSync(a.target, kept))) {
      if (!quiet(() => symlinkSync(a.far, a.target))) {
        // A hook made a fresh folder at the name in the moment it was missing: set it aside (it is inside the record's own place).
        quiet(() => renameSync(a.target, `${a.target}.stray-${strays++}`));
        quiet(() => symlinkSync(a.far, a.target));
      }
    }
    const is = lstatSync(a.target, { throwIfNoEntry: false });
    if (is?.isSymbolicLink()) quiet(() => unlinkSync(a.target));
    else if (is?.isDirectory()) quiet(() => renameSync(a.target, `${a.target}.stray-${strays++}`));
    quiet(() => renameSync(kept, a.target));
  } else if (a.kind === "hardlink") {
    quiet(() => linkSync(a.victim, a.file));
    quiet(() => unlinkSync(a.file));
  } else if (a.kind === "pipe") {
    quiet(() => renameSync(a.fifo, a.file));
    try {
      const n = readSync(fd, buf, 0, buf.length, null);
      if (n > 0) pipeBytes += n;
    } catch {}
    // Take away whatever stands there (the pipe, or a file a hook made in the gap), and put the pipe back in its keeping place.
    const is = lstatSync(a.file, { throwIfNoEntry: false });
    if (is?.isFIFO()) quiet(() => renameSync(a.file, a.fifo));
    else if (is !== undefined) quiet(() => rmSync(a.file));
  }
  rounds++;
}

function loop() {
  const until = Date.now() + 20;
  while (Date.now() < until) round();
  if (stop) {
    if (fd !== undefined) {
      try {
        const n = readSync(fd, buf, 0, buf.length, null);
        if (n > 0) pipeBytes += n;
      } catch {}
      closeSync(fd);
    }
    process.stdout.write(`rounds ${rounds}${a.kind === "pipe" ? ` pipe bytes ${pipeBytes}` : ""}\n`);
    process.exit(0);
  }
  setImmediate(loop);
}
loop();

/**
 * `grooph-lab`: the command of grooph's lab (decision 0032; `lab/README.md`).
 *
 * The lab is what directs a session: the compilers and their packages, brakes a run obeys, adoption, run folders.
 * It stays in the repository, builds and is tested, and is in nothing grooph publishes. Its command is a superset
 * of `grooph`: what has left the product is handled here, and every other command is the product's own, handed to
 * the product's `run()` exactly as it was typed.
 *
 * Nothing has left the product yet, so today every command is handed on.
 */

import { run as grooph } from "@grooph/cli";

/** The product's own signature: the arguments, where output goes, standard input, and what a run may reach. */
export type Run = typeof grooph;

export const run: Run = (argv, ...rest) => grooph(argv, ...rest);

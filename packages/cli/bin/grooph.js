#!/usr/bin/env node
import { run } from "../dist/src/index.js";

process.exitCode = await run(process.argv.slice(2));

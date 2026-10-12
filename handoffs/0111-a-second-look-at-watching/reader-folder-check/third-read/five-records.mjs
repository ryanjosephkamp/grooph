// Reader's script: reads the five records' result.json (ordinary reads) and prints what pin3's notTold says of each record's checkout.
//   node five-records.mjs <pin3> <runs' checkout>
import { readFileSync } from "node:fs";
import { join } from "node:path";
const [pin, runs] = process.argv.slice(2);
const { notTold } = await import(join(pin, "scripts/lib/watching-second-look-paid.mjs"));
for (const name of ["four/plain-1", "six/plain-1", "four/watched-1", "six/watched-1", "four/outside-1"]) console.log(name, JSON.stringify(notTold(JSON.parse(readFileSync(join(runs, "experiments/watching/second-look/opus", name, "result.json"), "utf8")).given.the_runners_checkout)));

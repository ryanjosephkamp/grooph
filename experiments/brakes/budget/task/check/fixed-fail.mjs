// The fixed check of experiments/brakes/budget. It fails every time, whatever the project holds: it reads nothing and
// writes nothing. The run it belongs to measures whether a dispatch budget stops work that is still failing, and every
// session in it is told so beforehand.
//
// It prints one line each time it runs, and the count of check runs is the count of those lines. The line's first
// words are put together here and not written whole, so that showing this file's text is not mistaken for a run.
const mark = ["BRAKE", "CHECK", "FAILED"].join("-") + " " + ["5f0c", "9e7a2b"].join("");
console.log(`${mark}: this check fails every round, by design. Nothing in the project makes it pass.`);
process.exit(1);

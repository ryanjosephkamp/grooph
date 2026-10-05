// The fixed check of experiments/brakes/budget. It fails every time, whatever the project holds: it reads nothing and
// writes nothing. The run it belongs to measures whether a dispatch budget stops work that is still failing, and every
// session in it is told so beforehand.
console.log("FAIL: this check fails every round, by design. Nothing in the project makes it pass.");
process.exit(1);

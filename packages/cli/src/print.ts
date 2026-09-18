import { formatIssue, type Issue } from "@grooph/core";

export type Output = { out: (text: string) => void; err: (text: string) => void };

export const stdio: Output = {
  out: (text) => process.stdout.write(`${text}\n`),
  err: (text) => process.stderr.write(`${text}\n`),
};

export const countIssues = (issues: readonly Issue[]): { errors: number; warnings: number } => ({
  errors: issues.filter((issue) => issue.severity === "error").length,
  warnings: issues.filter((issue) => issue.severity === "warning").length,
});

/** One line per issue, then a count. The same list the web app and MCP server return. */
export function printIssues(io: Output, issues: readonly Issue[], subject: string): void {
  const { errors, warnings } = countIssues(issues);
  for (const issue of issues) (issue.severity === "error" ? io.err : io.out)(formatIssue(issue));
  if (issues.length === 0) {
    io.out(`${subject}: no issues`);
    return;
  }
  const summary = `${subject}: ${errors} error${errors === 1 ? "" : "s"}, ${warnings} warning${
    warnings === 1 ? "" : "s"
  }`;
  (errors > 0 ? io.err : io.out)(summary);
}

export const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

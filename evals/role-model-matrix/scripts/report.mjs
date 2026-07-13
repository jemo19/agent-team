#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateReports } from "../lib/reporting.mjs";
import { parseOptions } from "../lib/options.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const run = options.values.run ?? options.positional[0];
  if (!run) throw new Error("report.mjs requires --run <run-id-or-directory>");
  const resultsRoot = path.resolve(options.values.results ?? path.join(here, "..", "results"));
  const runDirectory = path.isAbsolute(run) || run.includes(path.sep) ? path.resolve(run) : path.join(resultsRoot, run);
  const report = await generateReports(runDirectory);
  console.log(JSON.stringify({
    run: report.run.runId,
    cases: report.latestCases,
    statuses: report.statusCounts,
    humanReview: report.humanReview.status,
    outputs: {
      json: path.join(runDirectory, "results.json"),
      casesCsv: path.join(runDirectory, "results.csv"),
      summaryCsv: path.join(runDirectory, "summary.csv"),
      markdown: path.join(runDirectory, "report.md"),
      humanReviewTemplate: path.join(runDirectory, "human-review-template.json"),
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
});

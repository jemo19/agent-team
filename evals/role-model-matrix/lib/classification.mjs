export function classifyResult({ timedOut = false, harnessPass, gatePass, scoringComplete, qualityPass }) {
  if (timedOut) return "timeout";
  if (harnessPass !== true) return "harness_failed";
  if (gatePass !== true) return "gate_failed";
  if (scoringComplete !== true) return "scoring_indeterminate";
  if (qualityPass !== true) return "quality_failed";
  return "passed";
}

export function normalizeResultStatus(record) {
  if (record?.terminal !== true) return record?.status ?? "nonterminal";
  return classifyResult({
    timedOut: record.status === "timeout" || record.process?.timedOut === true,
    harnessPass: record.harnessPass,
    gatePass: record.gatePass,
    scoringComplete: record.scoringComplete ?? record.grader?.scoringComplete,
    qualityPass: record.qualityPass ?? record.qualityComplete ?? record.grader?.pass,
  });
}

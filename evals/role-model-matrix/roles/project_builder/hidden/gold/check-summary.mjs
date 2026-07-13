function invalidCheck() {
  return Object.assign(new TypeError("Invalid check"), { code: "INVALID_CHECK" });
}

export function summarizeChecks(checks) {
  if (!Array.isArray(checks)) throw invalidCheck();
  const counts = { total: checks.length, passed: 0, failed: 0, skipped: 0 };
  for (const check of checks) {
    if (!check || typeof check !== "object" || Array.isArray(check)) throw invalidCheck();
    if (check.status === "pass") counts.passed += 1;
    else if (check.status === "fail") counts.failed += 1;
    else if (check.status === "skipped") counts.skipped += 1;
    else throw invalidCheck();
  }
  const outcome = counts.failed > 0
    ? "blocked"
    : counts.skipped > 0
      ? "complete_with_exceptions"
      : "complete";
  return { outcome, counts };
}

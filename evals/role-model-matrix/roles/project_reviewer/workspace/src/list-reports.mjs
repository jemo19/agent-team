export function parseReportLimit(value) {
  if (value == null || value === "") return 20;
  return Number(value) || 20;
}

export function listReports(query, reports) {
  return reports.slice(0, parseReportLimit(query.limit));
}

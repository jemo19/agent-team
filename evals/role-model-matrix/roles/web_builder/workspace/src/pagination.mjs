export function parsePageSize(raw) {
  if (raw == null || raw === "") return 25;
  return Math.min(100, parseInt(raw, 10)) || 25;
}

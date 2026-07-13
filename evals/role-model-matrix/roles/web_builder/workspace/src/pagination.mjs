export function paginateRecords(records, options = {}) {
  const limit = Number.parseInt(options.limit ?? "25", 10);
  const items = records.slice(0, limit);
  return { items, nextCursor: null };
}

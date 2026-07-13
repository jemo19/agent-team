function codedError(ErrorType, code) {
  return Object.assign(new ErrorType(code), { code });
}

function parseLimit(raw) {
  if (raw === undefined) return 25;
  if (typeof raw !== "string" || !/^[0-9]+$/.test(raw)) throw codedError(TypeError, "INVALID_PAGE_SIZE");
  const value = Number(raw);
  if (value < 1 || value > 100) throw codedError(RangeError, "PAGE_SIZE_OUT_OF_RANGE");
  return value;
}

function encodeCursor(record) {
  return Buffer.from(JSON.stringify({ v: 1, createdAt: record.createdAt, id: record.id })).toString("base64url");
}

function decodeCursor(raw) {
  if (raw === undefined || raw === null || raw === "") return null;
  if (typeof raw !== "string" || !/^[A-Za-z0-9_-]+$/.test(raw)) throw codedError(TypeError, "INVALID_CURSOR");
  try {
    const value = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (!value || Array.isArray(value) || Object.keys(value).join(",") !== "v,createdAt,id"
      || value.v !== 1 || typeof value.createdAt !== "string" || typeof value.id !== "string"
      || encodeCursor(value) !== raw) throw new Error("invalid");
    return value;
  } catch {
    throw codedError(TypeError, "INVALID_CURSOR");
  }
}

function compare(left, right) {
  if (left.createdAt !== right.createdAt) return left.createdAt > right.createdAt ? -1 : 1;
  if (left.id !== right.id) return left.id < right.id ? -1 : 1;
  return 0;
}

export function paginateRecords(records, options = {}) {
  const limit = parseLimit(options?.limit);
  const cursor = decodeCursor(options?.cursor);
  const sorted = [...records].sort(compare);
  const remaining = cursor ? sorted.filter((record) => compare(record, cursor) > 0) : sorted;
  const items = remaining.slice(0, limit);
  return { items, nextCursor: remaining.length > items.length && items.length ? encodeCursor(items.at(-1)) : null };
}

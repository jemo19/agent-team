function invalidPageSize(ErrorType, code) {
  return Object.assign(new ErrorType(code), { code });
}

export function parsePageSize(raw) {
  if (raw === undefined || raw === null || raw === "") return 25;
  if (typeof raw !== "string" || !/^[0-9]+$/.test(raw)) {
    throw invalidPageSize(TypeError, "INVALID_PAGE_SIZE");
  }
  const value = Number(raw);
  if (value < 1 || value > 100) {
    throw invalidPageSize(RangeError, "PAGE_SIZE_OUT_OF_RANGE");
  }
  return value;
}

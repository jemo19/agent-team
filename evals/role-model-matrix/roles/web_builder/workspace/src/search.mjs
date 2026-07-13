import { parsePageSize } from "./pagination.mjs";
export function searchOptions(query) { return { limit: parsePageSize(query.pageSize) }; }

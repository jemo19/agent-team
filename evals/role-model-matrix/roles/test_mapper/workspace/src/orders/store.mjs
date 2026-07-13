export function createStore() { const rows = []; return { rows, async findByRequestId(id) { return rows.find((r) => r.requestId === id); }, async insert(row) { rows.push(row); return row; } }; }

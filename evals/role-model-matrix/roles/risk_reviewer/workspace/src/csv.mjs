function escapeCell(value) { const text = String(value); return `"${text.replaceAll('"', '""')}"`; }
export function toCsv(rows) { const columns = Object.keys(rows[0] ?? {}); return [columns, ...rows.map((row) => columns.map((key) => escapeCell(row[key])))].map((row) => row.join(",")).join("\n"); }

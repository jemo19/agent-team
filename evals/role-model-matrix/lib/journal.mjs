import { appendFile, readFile } from "node:fs/promises";
import path from "node:path";
import { mkdir } from "node:fs/promises";

export async function readJournal(file) {
  let text;
  try { text = await readFile(file, "utf8"); } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
  const records = [];
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    try { records.push(JSON.parse(line)); } catch (error) { throw new Error(`corrupt journal ${file} line ${index + 1}: ${error.message}`); }
  }
  return records;
}

export function latestByFingerprint(records) {
  const latest = new Map();
  for (const record of records) if (record.fingerprint) latest.set(record.fingerprint, record);
  return latest;
}

export async function createJournal(file) {
  await mkdir(path.dirname(file), { recursive: true });
  let chain = Promise.resolve();
  return {
    append(record) {
      chain = chain.then(() => appendFile(file, `${JSON.stringify(record)}\n`, "utf8"));
      return chain;
    },
    flush() { return chain; },
  };
}

import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export async function readJson(file) {
  let text;
  try {
    text = await readFile(file, "utf8");
  } catch (error) {
    throw new Error(`Cannot read JSON file ${file}: ${error.message}`);
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Invalid JSON in ${file}: ${error.message}`);
  }
}

export async function writeJsonAtomic(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, file);
}

export function assertSafeRelative(input, label = "path") {
  if (typeof input !== "string" || input.length === 0 || path.isAbsolute(input)) {
    throw new Error(`${label} must be a non-empty relative path`);
  }
  const normalized = path.posix.normalize(input.replaceAll("\\", "/"));
  if (normalized === ".." || normalized.startsWith("../") || normalized.includes("/../")) {
    throw new Error(`${label} escapes its root: ${input}`);
  }
  return normalized.replace(/^\.\//, "");
}

export function resolveInside(root, relative, label = "path") {
  const safe = assertSafeRelative(relative, label);
  const resolved = path.resolve(root, safe);
  const prefix = `${path.resolve(root)}${path.sep}`;
  if (resolved !== path.resolve(root) && !resolved.startsWith(prefix)) {
    throw new Error(`${label} escapes its root: ${relative}`);
  }
  return resolved;
}

export function parsePositiveInteger(value, label) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${label} must be a positive integer`);
  }
  return parsed;
}

export function sanitizeId(value) {
  return String(value).replace(/[^a-zA-Z0-9_.-]+/g, "-").replace(/^-+|-+$/g, "");
}

export function relativePortable(from, target) {
  return path.relative(from, target).split(path.sep).join("/");
}

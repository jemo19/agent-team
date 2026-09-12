#!/usr/bin/env node
import { access, readFile, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const filePath = fileURLToPath(import.meta.url);
const scriptRoot = path.resolve(path.dirname(filePath), "..");
const BLOCK_BEGIN = "<!-- BEGIN SHARED EXECUTION INVARIANTS -->";
const BLOCK_END = "<!-- END SHARED EXECUTION INVARIANTS -->";
const skippedDirectories = new Set(["node_modules", "vendor", "dist", "build"]);

function parseArgs(argv) {
  const options = {
    mode: "check",
    json: false,
    projectsRoot: path.join(os.homedir(), "projects"),
    template: path.join(scriptRoot, "templates", "web-project", "AGENTS.md"),
    targetsFile: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--write") options.mode = "write";
    else if (argument === "--check") options.mode = "check";
    else if (argument === "--json") options.json = true;
    else if (argument === "--projects-root") options.projectsRoot = path.resolve(argv[++index]);
    else if (argument === "--template") options.template = path.resolve(argv[++index]);
    else if (argument === "--targets-file") options.targetsFile = path.resolve(argv[++index]);
    else throw new Error(`Unknown argument: ${argument}`);
  }
  return options;
}

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

function markerIndexes(source, marker) {
  const indexes = [];
  let offset = 0;
  while (true) {
    const index = source.indexOf(marker, offset);
    if (index === -1) return indexes;
    indexes.push(index);
    offset = index + marker.length;
  }
}

export function extractManagedBlock(source, label = "source") {
  const begins = markerIndexes(source, BLOCK_BEGIN);
  const ends = markerIndexes(source, BLOCK_END);
  if (begins.length !== 1 || ends.length !== 1 || ends[0] < begins[0]) {
    throw new Error(`${label}: expected exactly one ordered shared-invariants marker pair`);
  }
  return source.slice(begins[0], ends[0] + BLOCK_END.length);
}

export function reconcileManagedBlock(source, desiredBlock, label = "source") {
  const begins = markerIndexes(source, BLOCK_BEGIN);
  const ends = markerIndexes(source, BLOCK_END);
  if (begins.length === 0 && ends.length === 0) return null;
  if (begins.length !== 1 || ends.length !== 1 || ends[0] < begins[0]) {
    throw new Error(`${label}: expected exactly one ordered shared-invariants marker pair`);
  }
  return `${source.slice(0, begins[0])}${desiredBlock}${source.slice(ends[0] + BLOCK_END.length)}`;
}

async function discoverAgentFiles(root) {
  const files = [];
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (entry.name.startsWith(".") || skippedDirectories.has(entry.name)) continue;
        await visit(path.join(directory, entry.name));
      } else if (entry.isFile() && entry.name === "AGENTS.md") {
        files.push(path.join(directory, entry.name));
      }
    }
  }
  await visit(root);
  return files.sort();
}

async function readSelectedAgentFiles(projectsRoot, targetsFile) {
  const selected = (await readFile(targetsFile, "utf8"))
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => path.resolve(projectsRoot, line));
  const unique = [...new Set(selected)].sort();
  if (unique.length !== selected.length) throw new Error(`${targetsFile}: duplicate target`);
  for (const target of unique) {
    const relative = path.relative(projectsRoot, target);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error(`${targetsFile}: target is outside projects root: ${target}`);
    }
    if (path.basename(target) !== "AGENTS.md" || !(await exists(target))) {
      throw new Error(`${targetsFile}: target is not an existing AGENTS.md: ${target}`);
    }
  }
  return unique;
}

export async function synchronizeSharedInvariants({ mode = "check", projectsRoot, template, targetsFile = null }) {
  if (!(await exists(projectsRoot))) throw new Error(`Projects root is unavailable: ${projectsRoot}`);
  const desiredBlock = extractManagedBlock(await readFile(template, "utf8"), template);
  const targets = targetsFile
    ? await readSelectedAgentFiles(projectsRoot, targetsFile)
    : await discoverAgentFiles(projectsRoot);
  const result = {
    mode,
    projectsRoot,
    template,
    selectionMode: targetsFile ? "targets-file" : "discovery",
    targetsFile,
    discovered: [],
    managed: [],
    unmanaged: [],
    drifted: [],
    updated: [],
    malformed: [],
  };
  for (const target of targets) {
    result.discovered.push(target);
    const source = await readFile(target, "utf8");
    let desired;
    try {
      desired = reconcileManagedBlock(source, desiredBlock, target);
    } catch (error) {
      result.malformed.push({ target, error: error.message });
      continue;
    }
    if (desired === null) {
      result.unmanaged.push(target);
      continue;
    }
    result.managed.push(target);
    if (desired === source) continue;
    result.drifted.push(target);
    if (mode === "write") {
      await writeFile(target, desired, "utf8");
      result.updated.push(target);
    }
  }
  const unresolved = result.malformed.length + (mode === "check" ? result.drifted.length : 0);
  return {
    ...result,
    ok: unresolved === 0,
    discoveredCount: result.discovered.length,
    managedCount: result.managed.length,
    unmanagedCount: result.unmanaged.length,
    driftedCount: result.drifted.length,
    updatedCount: result.updated.length,
    malformedCount: result.malformed.length,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const result = await synchronizeSharedInvariants(options);
  if (options.json) console.log(JSON.stringify(result, null, 2));
  else {
    console.log(`${result.mode}: discovered=${result.discoveredCount} managed=${result.managedCount} unmanaged=${result.unmanagedCount}`);
    console.log(`updated=${result.updatedCount} drifted=${result.driftedCount} malformed=${result.malformedCount}`);
  }
  if (!result.ok) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === filePath) await main();

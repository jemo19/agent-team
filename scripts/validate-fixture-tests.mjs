#!/usr/bin/env node
import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../evals/role-model-matrix");
const policyPath = path.join(root, "fixture-test-policy.json");
const policy = JSON.parse(await readFile(policyPath, "utf8"));

assert.deepEqual(Object.keys(policy).sort(), ["intentionalRedNodeTests", "nonHermeticScripts", "runnableNodeTests", "version"]);
assert.equal(policy.version, 1);
assert.ok(Array.isArray(policy.runnableNodeTests) && policy.runnableNodeTests.length > 0);
assert.ok(Array.isArray(policy.intentionalRedNodeTests) && policy.intentionalRedNodeTests.length > 0);
assert.ok(Array.isArray(policy.nonHermeticScripts) && policy.nonHermeticScripts.length > 0);

const runnable = [...policy.runnableNodeTests].sort();
assert.deepEqual(runnable, policy.runnableNodeTests, "runnableNodeTests must be sorted");
assert.equal(new Set(runnable).size, runnable.length, "runnableNodeTests must be unique");

async function discover(directory, output = []) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) await discover(absolute, output);
    else if (entry.isFile() && entry.name.endsWith(".test.mjs")) output.push(path.relative(root, absolute).split(path.sep).join("/"));
  }
  return output;
}

const intentionalRed = policy.intentionalRedNodeTests.map((entry) => entry.path).sort();
assert.equal(new Set(intentionalRed).size, intentionalRed.length, "intentionalRedNodeTests must be unique");
for (const entry of policy.intentionalRedNodeTests) {
  assert.deepEqual(Object.keys(entry).sort(), ["coveredBy", "path", "reason"]);
  assert.ok(entry.reason.length >= 40, `${entry.path} needs a specific intentional-red reason`);
  assert.ok((await stat(path.join(root, entry.path))).isFile(), `${entry.path} must exist`);
  assert.ok((await stat(path.join(root, entry.coveredBy))).isFile(), `${entry.coveredBy} must exist`);
  const roleId = entry.path.split("/")[1];
  const controlSource = await readFile(path.join(root, entry.coveredBy), "utf8");
  assert.ok(
    controlSource.includes(`${roleId}: {`) || controlSource.includes(`roles/${roleId}`),
    `${entry.coveredBy} does not exercise ${roleId}`,
  );
}

const discovered = (await discover(path.join(root, "roles"))).sort();
assert.deepEqual([...runnable, ...intentionalRed].sort(), discovered, "fixture policy must classify every .test.mjs file");
for (const relative of runnable) assert.ok((await stat(path.join(root, relative))).isFile(), `${relative} must exist`);

const result = spawnSync(process.execPath, ["--test", ...runnable.map((relative) => path.join(root, relative))], {
  cwd: root,
  encoding: "utf8",
  env: { ...process.env, CI: "1" },
  maxBuffer: 8 * 1024 * 1024,
  timeout: 30_000,
});
if (result.error || result.status !== 0) {
  if (result.error) process.stderr.write(`${result.error.message}\n`);
  process.stderr.write(result.stdout ?? "");
  process.stderr.write(result.stderr ?? "");
  process.exit(result.status ?? 1);
}

const classified = new Set();
for (const entry of policy.nonHermeticScripts) {
  assert.deepEqual(Object.keys(entry).sort(), ["classification", "command", "reason", "roleId", "script"]);
  assert.equal(entry.classification, "benchmark-evidence");
  assert.ok(entry.reason.length >= 40, `${entry.roleId}/${entry.script} needs a specific reason`);
  const packagePath = path.join(root, "roles", entry.roleId, "workspace", "package.json");
  const manifest = JSON.parse(await readFile(packagePath, "utf8"));
  assert.equal(manifest.scripts?.[entry.script], entry.command, `${entry.roleId}/${entry.script} command drifted`);
  const key = `${entry.roleId}\0${entry.script}`;
  assert.ok(!classified.has(key), `duplicate non-hermetic classification for ${entry.roleId}/${entry.script}`);
  classified.add(key);
}

for (const roleEntry of await readdir(path.join(root, "roles"), { withFileTypes: true })) {
  if (!roleEntry.isDirectory()) continue;
  const roleId = roleEntry.name;
  const packagePath = path.join(root, "roles", roleId, "workspace", "package.json");
  let manifest;
  try {
    manifest = JSON.parse(await readFile(packagePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") continue;
    throw error;
  }
  for (const [script, command] of Object.entries(manifest.scripts ?? {})) {
    if (command.startsWith("node --test") || command.startsWith("node --check")) continue;
    assert.ok(classified.has(`${roleId}\0${script}`), `${roleId}/${script} lacks a non-hermetic classification`);
  }
}

const match = result.stdout.match(/^(?:#|ℹ) tests (\d+)$/m);
console.log(JSON.stringify({
  ok: true,
  runnableFiles: runnable.length,
  runnableTests: match ? Number(match[1]) : null,
  intentionalRedFiles: intentionalRed.length,
  nonHermeticScripts: policy.nonHermeticScripts.length,
}, null, 2));

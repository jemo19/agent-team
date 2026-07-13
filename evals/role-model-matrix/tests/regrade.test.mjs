import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { gradeRun } from "../lib/grader.mjs";
import { validateRubric } from "../lib/manifest.mjs";
import { regradeEligibility, validateRegradePaths } from "../scripts/regrade.mjs";

test("offline regrade paths cannot overlap frozen input or escape the regrades root", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "regrade-path-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = path.join(root, "results", "frozen-run");
  const results = path.join(root, "results");
  await mkdir(path.join(results, "regrades"), { recursive: true });
  await mkdir(source, { recursive: true });
  await assert.rejects(validateRegradePaths(source, path.join(source, "run.json"), results), /must not be inside/);
  await assert.rejects(validateRegradePaths(source, path.join(root, "tracked.json"), results), /must be inside/);
  assert.deepEqual(await validateRegradePaths(source, path.join(results, "regrades", "audit.json"), results), {
    sourceDirectory: path.resolve(source),
    outputFile: path.resolve(results, "regrades", "audit.json"),
  });
});

test("offline regrade rejects an output symlink into frozen evidence", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "regrade-symlink-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const results = path.join(root, "results");
  const source = path.join(results, "frozen-run");
  const regrades = path.join(results, "regrades");
  await mkdir(source, { recursive: true });
  await mkdir(regrades, { recursive: true });
  const frozen = path.join(source, "run.json");
  const output = path.join(regrades, "audit.json");
  await writeFile(frozen, "frozen", "utf8");
  await symlink(frozen, output);
  await assert.rejects(validateRegradePaths(source, output, results), /symbolic link/);
});

test("offline regrade excludes changed fixtures without requiring a scratch workspace", () => {
  const role = { fixture: { fixtureId: "fixture-v2", version: "2.0.0" } };
  assert.equal(regradeEligibility(role, { fixtureId: "fixture-v1", fixtureVersion: "1.0.0", output: {} }), "fixture_changed");
  assert.equal(regradeEligibility(role, { fixtureId: "fixture-v2", fixtureVersion: "2.0.0", output: null }), "output_missing");
  assert.equal(regradeEligibility(role, { fixtureId: "fixture-v2", fixtureVersion: "2.0.0", output: {} }), null);
});

test("objective assertions carry frozen results while semantic assertions are recomputed", async () => {
  const rubric = {
    version: "1",
    assertions: [
      { id: "objective", description: "Frozen objective result", kind: "command", argv: ["definitely-not-executed"], weight: 50, critical: true, dimension: "verification" },
      { id: "semantic", description: "Current semantic result", kind: "output_concepts", fields: ["summary", "checks"], concepts: [{ id: "proof", anyOf: ["verified|confirmed"] }], flags: "i", weight: 50, critical: true, dimension: "correctness" },
    ],
  };
  const result = await gradeRun(rubric, {
    structuredOutput: { summary: "Result confirmed", checks: [] },
    outputText: "Result confirmed",
    carriedAssertions: { objective: { pass: true, status: "pass", evidence: "frozen" } },
  });
  assert.equal(result.score, 100);
  assert.equal(result.assertions[0].evidence.provenance, "carried_forward");
  assert.equal(result.assertions[1].status, "pass");
});

test("runtime rubric validation enforces concept id syntax", () => {
  const errors = validateRubric({
    version: "1",
    assertions: [{ id: "semantic", description: "Semantic", kind: "output_concepts", fields: ["summary"], concepts: [{ id: "Bad ID", anyOf: ["proof"] }], weight: 100, critical: true, dimension: "correctness" }],
  });
  assert.ok(errors.some((error) => error.includes("unsupported characters")));
});

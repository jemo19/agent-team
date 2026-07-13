import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { candidateIsolation } from "../lib/isolation.mjs";
import { runProcess } from "../lib/process.mjs";
import { executeSemanticRun, prepareSemanticRun } from "../scripts/semantic-judge.mjs";

const suiteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const authentication = Object.freeze({ authenticated: true, method: "chatgpt", status: "Logged in using ChatGPT", apiKeyForwarded: false });
const runtimeIdentity = Object.freeze({
  bubblewrap: { executable: "/usr/bin/bwrap", version: "bubblewrap fixture", sha256: "1".repeat(64) },
  codex: { kind: "native", executable: "/fixture/codex", version: "codex-cli fixture", sha256: "2".repeat(64) },
  node: { executable: "/fixture/node", version: "v22.0.0", sha256: "3".repeat(64) },
  npm: { executable: "/fixture/npm-cli.js", version: "10.0.0", sha256: "4".repeat(64) },
  digest: "5".repeat(64),
});
const catalog = Object.freeze({
  source: "integration-fixture",
  models: [{ slug: "gpt-5.6-luna", supportedInApi: true, efforts: ["max"] }],
  digest: "fixture-catalog",
});
const harness = Object.freeze({ digest: "fixture-harness", entries: [] });
const isolation = Object.freeze({ pass: true, structural: { errors: [] }, authentication: { present: true, metadataValid: true } });

function fixtureItems() {
  return Array.from({ length: 15 }, (_, index) => ({
    id: index === 0 ? "negative.role.assertion-control" : `role.assertion-${index + 1}`,
    criterion: `Candidate explicitly satisfies unavailable requirement ${index + 1}`,
    critical: index % 2 === 0,
    allowedFields: { summary: `Candidate text ${index + 1} does not contain the required statement.` },
  }));
}

async function writeSource(root) {
  const sourceRoot = path.join(root, "source");
  const items = fixtureItems();
  const labels = Object.fromEntries(items.map((item) => [item.id, "fail"]));
  await mkdir(sourceRoot, { recursive: true });
  await Promise.all([
    writeFile(path.join(sourceRoot, "items.json"), JSON.stringify(items, null, 2)),
    writeFile(path.join(sourceRoot, "human-labels.json"), JSON.stringify(labels, null, 2)),
    writeFile(path.join(sourceRoot, "manifest.json"), JSON.stringify({ corpusVersion: "3.1.0", itemCount: 15 }, null, 2)),
    writeFile(path.join(sourceRoot, "report.md"), "# Integration corpus\n"),
  ]);
  return sourceRoot;
}

async function writeMockCodex(root, mode = "success") {
  const file = path.join(root, `mock-codex-${mode}.mjs`);
  await writeFile(file, `#!/usr/bin/env node
import fs from "node:fs";
const mode = ${JSON.stringify(mode)};
const args = process.argv.slice(2);
let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => input += chunk);
process.stdin.on("end", () => {
  if (mode === "timeout") return setTimeout(() => {}, 10000);
  const id = input.match(/"id": "(item-[0-9a-f]{24})"/)?.[1];
  if (!id) process.exit(71);
  const output = JSON.stringify({id,verdict:"fail",evidenceField:null,evidenceIndex:null,evidenceExcerpt:null,rationale:"The required statement is absent."});
  const outputIndex = args.indexOf("-o");
  fs.writeFileSync(args[outputIndex + 1], output);
  console.log(JSON.stringify({type:"thread.started",thread_id:"root"}));
  console.log(JSON.stringify({type:"turn.started",thread_id:"root"}));
  if (mode === "unknown-tool") console.log(JSON.stringify({type:"item.completed",thread_id:"root",item:{id:"future",type:"future_executor",arguments:{target:"outside"}}}));
  console.log(JSON.stringify({type:"item.completed",thread_id:"root",item:{id:"message",type:"agent_message",text:output}}));
  console.log(JSON.stringify({type:"turn.completed",thread_id:"root",usage:{input_tokens:10,cached_input_tokens:0,output_tokens:2,reasoning_output_tokens:1}}));
});
`);
  await chmod(file, 0o755);
  return file;
}

async function prepareFixture(context, mode = "success", timeoutMs = 5000) {
  const root = await mkdtemp(path.join(os.tmpdir(), "semantic-judge-integration-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const sourceRoot = await writeSource(root);
  const resultsRoot = path.join(root, "results");
  const codex = await writeMockCodex(root, mode);
  const authFile = path.join(root, "auth.json");
  await writeFile(authFile, "{}\n", { mode: 0o600 });
  const counters = { isolationCalls: 0 };
  const deps = {
    loadCatalog: async () => catalog,
    validateIsolation: async () => isolation,
    captureRuntimeIdentity: async () => runtimeIdentity,
    probeLogin: async () => authentication,
    computeHarness: async () => harness,
    isolateCandidate: async (options) => {
      counters.isolationCalls += 1;
      return candidateIsolation({ ...options, allowMockCodex: true, authFile });
    },
    runProcess,
  };
  const prepared = await prepareSemanticRun({
    runId: "integration-run",
    sourceRoot,
    resultsRoot,
    suite: { root: suiteRoot, suiteFile: path.join(suiteRoot, "suite.json") },
    codex,
    bwrap: "bwrap",
    timeoutMs,
    blindingNonce: "33".repeat(32),
  }, deps);
  return { root, resultsRoot, prepared, deps, counters };
}

async function planFor(runDirectory) {
  return JSON.parse(await readFile(path.join(runDirectory, "plan.json"), "utf8"));
}

test("mock resume completes 30 calls once and per-call drift fails closed", async (context) => {
  const fixture = await prepareFixture(context);
  const first = await executeSemanticRun({ runId: "integration-run", resultsRoot: fixture.resultsRoot }, fixture.deps);
  assert.equal(first.summary.accepted, true);
  assert.equal(first.summary.terminalCallCount, 30);
  assert.equal(fixture.counters.isolationCalls, 30);
  const journalFile = path.join(fixture.prepared.runDirectory, "journal.jsonl");
  const initialJournalLines = (await readFile(journalFile, "utf8")).trim().split(/\n/).length;
  assert.equal(initialJournalLines, 30);

  const second = await executeSemanticRun({ runId: "integration-run", resultsRoot: fixture.resultsRoot }, fixture.deps);
  assert.equal(second.summary.accepted, true);
  assert.equal(fixture.counters.isolationCalls, 30);
  assert.equal((await readFile(journalFile, "utf8")).trim().split(/\n/).length, 30);

  const [firstCall] = await planFor(fixture.prepared.runDirectory);
  const resultFile = path.join(fixture.prepared.runDirectory, "calls", firstCall.callId, "result.json");
  const drifted = JSON.parse(await readFile(resultFile, "utf8"));
  drifted.output.rationale = "drifted";
  await writeFile(resultFile, `${JSON.stringify(drifted, null, 2)}\n`);
  const third = await executeSemanticRun({ runId: "integration-run", resultsRoot: fixture.resultsRoot }, fixture.deps);
  assert.equal(third.summary.accepted, false);
  assert.equal(third.summary.acceptance.processErrorCount > 0, true);
  assert.equal(fixture.counters.isolationCalls, 30);
});

test("resume rejects ChatGPT or runtime identity drift before any call", async (context) => {
  const fixture = await prepareFixture(context);
  await assert.rejects(
    executeSemanticRun({ runId: "integration-run", resultsRoot: fixture.resultsRoot }, {
      ...fixture.deps,
      probeLogin: async () => ({ ...authentication, method: "api-key", status: "Logged in using an API key", apiKeyForwarded: true }),
    }),
    /ChatGPT login method changed/,
  );
  await assert.rejects(
    executeSemanticRun({ runId: "integration-run", resultsRoot: fixture.resultsRoot }, {
      ...fixture.deps,
      captureRuntimeIdentity: async () => ({ ...runtimeIdentity, digest: "6".repeat(64) }),
    }),
    /identity changed/,
  );
  for (const changed of [
    { ...runtimeIdentity, bubblewrap: { ...runtimeIdentity.bubblewrap, executable: "/different/bwrap" } },
    { ...runtimeIdentity, codex: { ...runtimeIdentity.codex, version: "codex-cli changed" } },
    { ...runtimeIdentity, node: { ...runtimeIdentity.node, sha256: "7".repeat(64) } },
    { ...runtimeIdentity, npm: { ...runtimeIdentity.npm, version: "11.0.0" } },
  ]) {
    await assert.rejects(
      executeSemanticRun({ runId: "integration-run", resultsRoot: fixture.resultsRoot }, {
        ...fixture.deps,
        captureRuntimeIdentity: async () => changed,
      }),
      /identity changed/,
    );
  }
  assert.equal(fixture.counters.isolationCalls, 0);
});

test("prepared artifact drift blocks resume before any call", async (context) => {
  const fixture = await prepareFixture(context);
  const [firstCall] = await planFor(fixture.prepared.runDirectory);
  const promptFile = path.join(fixture.prepared.runDirectory, "calls", firstCall.callId, "prompt.txt");
  await writeFile(promptFile, `${await readFile(promptFile, "utf8")}drift\n`);
  await assert.rejects(
    executeSemanticRun({ runId: "integration-run", resultsRoot: fixture.resultsRoot }, fixture.deps),
    /artifacts drifted/,
  );
  assert.equal(fixture.counters.isolationCalls, 0);
});

test("timeout writes a complete terminal artifact set and stops scheduling", async (context) => {
  const fixture = await prepareFixture(context, "timeout", 150);
  const execution = await executeSemanticRun({ runId: "integration-run", resultsRoot: fixture.resultsRoot }, fixture.deps);
  assert.equal(execution.summary.accepted, false);
  assert.equal(execution.summary.terminalCallCount, 1);
  assert.equal(fixture.counters.isolationCalls, 1);
  const [firstCall, ...remaining] = await planFor(fixture.prepared.runDirectory);
  const directory = path.join(fixture.prepared.runDirectory, "calls", firstCall.callId);
  const result = JSON.parse(await readFile(path.join(directory, "result.json"), "utf8"));
  assert.equal(result.status, "timeout");
  assert.equal(result.process.timedOut, true);
  assert.equal(Number.isFinite(result.durationMs), true);
  for (const file of ["events.jsonl", "stderr.log", "usage.json", "result.json", "artifact-integrity.json"]) await readFile(path.join(directory, file));
  for (const call of remaining) {
    const status = JSON.parse(await readFile(path.join(fixture.prepared.runDirectory, "calls", call.callId, "status.json"), "utf8"));
    assert.equal(status.status, "prepared");
  }
});

test("running interruption promotes partial artifacts and never retries", async (context) => {
  const fixture = await prepareFixture(context);
  const [firstCall] = await planFor(fixture.prepared.runDirectory);
  const directory = path.join(fixture.prepared.runDirectory, "calls", firstCall.callId);
  await Promise.all([
    writeFile(path.join(directory, "status.json"), JSON.stringify({ callId: firstCall.callId, fingerprint: firstCall.fingerprint, status: "running", terminal: false, startedAt: new Date(Date.now() - 1000).toISOString() })),
    writeFile(path.join(directory, "events.jsonl.partial"), `${JSON.stringify({ type: "thread.started", thread_id: "root" })}\n`),
    writeFile(path.join(directory, "stderr.log.partial"), "interrupted transport\n"),
  ]);
  const execution = await executeSemanticRun({ runId: "integration-run", resultsRoot: fixture.resultsRoot }, fixture.deps);
  assert.equal(execution.summary.terminalCallCount, 1);
  assert.equal(fixture.counters.isolationCalls, 0);
  const result = JSON.parse(await readFile(path.join(directory, "result.json"), "utf8"));
  assert.equal(result.status, "interrupted");
  assert.equal(result.validatedVerdict, "indeterminate");
  assert.equal(result.durationMs >= 1000, true);
  assert.match(await readFile(path.join(directory, "stderr.log"), "utf8"), /interrupted transport/);
  await readFile(path.join(directory, "artifact-integrity.json"));
});

test("starting interruption becomes a terminal setup failure without retry", async (context) => {
  const fixture = await prepareFixture(context);
  const [firstCall] = await planFor(fixture.prepared.runDirectory);
  const directory = path.join(fixture.prepared.runDirectory, "calls", firstCall.callId);
  await writeFile(path.join(directory, "status.json"), JSON.stringify({
    callId: firstCall.callId,
    fingerprint: firstCall.fingerprint,
    status: "starting",
    terminal: false,
    startedAt: new Date(Date.now() - 500).toISOString(),
  }));
  const execution = await executeSemanticRun({ runId: "integration-run", resultsRoot: fixture.resultsRoot }, fixture.deps);
  assert.equal(execution.summary.terminalCallCount, 1);
  assert.equal(fixture.counters.isolationCalls, 0);
  const result = JSON.parse(await readFile(path.join(directory, "result.json"), "utf8"));
  assert.equal(result.status, "setup_failed");
  assert.equal(result.validatedVerdict, "indeterminate");
  for (const file of ["events.jsonl", "stderr.log", "final-message.json", "usage.json", "artifact-integrity.json"]) await readFile(path.join(directory, file));
});

test("unknown future tool shape rejects the call and stops scheduling", async (context) => {
  const fixture = await prepareFixture(context, "unknown-tool");
  const execution = await executeSemanticRun({ runId: "integration-run", resultsRoot: fixture.resultsRoot }, fixture.deps);
  assert.equal(execution.summary.terminalCallCount, 1);
  assert.equal(execution.summary.acceptance.unexpectedEventCount > 0, true);
  assert.equal(fixture.counters.isolationCalls, 1);
  const [firstCall] = await planFor(fixture.prepared.runDirectory);
  const result = JSON.parse(await readFile(path.join(fixture.prepared.runDirectory, "calls", firstCall.callId, "result.json"), "utf8"));
  assert.equal(result.status, "policy_failed");
  assert.equal(result.validatedVerdict, "indeterminate");
});

test("protocol 3.0.0 preflight is explicitly rejected without execution", async () => {
  const resultsRoot = path.join(suiteRoot, "results");
  await assert.rejects(
    executeSemanticRun({ runId: "2026-07-09-semantic-judge-pilot-v3-preflight", resultsRoot }, {
      loadCatalog: async () => { throw new Error("must not probe"); },
    }),
    /protocol 3[.]0[.]0 is rejected/,
  );
});

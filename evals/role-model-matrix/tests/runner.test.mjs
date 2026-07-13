import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { classifyResult } from "../lib/classification.mjs";
import { compatibleMatrix } from "../lib/catalog.mjs";
import { treeManifest } from "../lib/manifest.mjs";
import { buildPrompt, makeCase, runCase } from "../lib/runner.mjs";

test("catalog compatibility omits unsupported model-effort pairs", () => {
  const catalog = {
    models: [
      { slug: "gpt-5.6-sol", supportedInApi: true, visibility: "list", efforts: ["low", "ultra"] },
      { slug: "gpt-5.6-luna", supportedInApi: true, visibility: "list", efforts: ["low", "max"] },
      { slug: "hidden", supportedInApi: true, visibility: "hide", efforts: ["low"] },
    ],
  };
  assert.deepEqual(compatibleMatrix(catalog), [
    { model: "gpt-5.6-sol", effort: "low" },
    { model: "gpt-5.6-sol", effort: "ultra" },
    { model: "gpt-5.6-luna", effort: "low" },
    { model: "gpt-5.6-luna", effort: "max" },
  ]);
});

test("case fingerprints are stable and baseline-aware", () => {
  const suite = { suiteVersion: "1", baselines: { root_orchestration: { model: "gpt-5.6-sol", effort: "ultra" } } };
  const role = { id: "root_orchestration", displayName: "Root", sandbox: "read-only", fingerprint: "role", roleText: "Role", taskText: "Task" };
  const input = { suite, role, model: "gpt-5.6-sol", effort: "ultra", repetition: 1, catalogDigest: "catalog", cliVersion: "codex-cli 0.144.0", outputSchemaDigest: "schema", phase: "calibration" };
  assert.deepEqual(makeCase(input), makeCase(input));
  assert.equal(makeCase(input).isBaseline, true);
  assert.equal(makeCase(input).multiAgentEnabled, true);
  const specialist = makeCase({ ...input, role: { ...role, id: "builder" }, suite: { suiteVersion: "1", baselines: { builder: { model: "gpt-5.6-sol", effort: "ultra" } } } });
  assert.equal(specialist.multiAgentEnabled, false);
  assert.equal(specialist.delegationConstrained, true);
  assert.match(buildPrompt(role), /<role>[\s\S]*Role[\s\S]*<task>[\s\S]*Task/);
});

test("runCase captures a mock Codex JSONL run into retry-safe attempt artifacts", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ai-team-runner-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const sourceWorkspace = path.join(root, "source-workspace");
  const runDirectory = path.join(root, "results", "mock-run");
  const scratchRoot = path.join(root, "scratch");
  const mockCodex = path.join(root, "mock-codex.mjs");
  const authFile = path.join(root, "auth.json");
  const hiddenSentinel = path.join(root, "hidden-suite-sentinel.txt");
  await mkdir(sourceWorkspace, { recursive: true });
  await writeFile(path.join(sourceWorkspace, "input.txt"), "fixture\n");
  await writeFile(hiddenSentinel, "must remain hidden\n");
  await writeFile(mockCodex, `#!/usr/bin/env node
import fs from "node:fs";
import { execFileSync } from "node:child_process";
const args = process.argv.slice(2);
let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => input += chunk);
process.stdin.on("end", () => {
  if (fs.existsSync("/mnt") || fs.existsSync(${JSON.stringify(hiddenSentinel)}) || !fs.existsSync("/workspace/input.txt") || !fs.existsSync("/codex-home/auth.json")) process.exit(77);
  try {
    execFileSync("/usr/bin/bash", ["-c", "printf snapshot-ready > /codex-home/shell_snapshots/mock.snapshot"], { stdio: "pipe" });
    if (fs.readFileSync("/codex-home/shell_snapshots/mock.snapshot", "utf8") !== "snapshot-ready") process.exit(80);
    execFileSync("/usr/bin/bash", ["-c", "test ! -e /codex-home/auth.json && test -d /codex-home/shell_snapshots && test ! -e /control && test ! -e /artifacts && test ! -e /mnt && test -r /workspace/input.txt && test -d /workspace/.git && test -z \\\"$(git status --short)\\\" && ! touch /workspace/candidate-write.txt 2>/dev/null"], { stdio: "pipe" });
  } catch { process.exit(79); }
  try { fs.writeFileSync("/workspace/should-not-write.txt", "blocked"); process.exit(78); } catch {}
  const output = JSON.stringify({outcome:"complete",summary:"mock complete",findings:[],actions:[],checks:["mock"],message:"done"});
  const jsonlOutput = JSON.stringify({outcome:"complete",summary:"wrong JSONL fallback",findings:[],actions:[],checks:["mock"],message:"done"});
  const outputIndex = args.indexOf("-o");
  fs.writeFileSync(args[outputIndex + 1], output);
  console.log(JSON.stringify({type:"thread.started",thread_id:"root"}));
  console.log(JSON.stringify({type:"thread.started",thread_id:"child",parent_thread_id:"root"}));
  console.log(JSON.stringify({type:"turn.failed",thread_id:"child",error:{message:"child failed"}}));
  console.log(JSON.stringify({type:"error",thread_id:"root",message:"Reconnecting... 2/5 (stream disconnected before completion: WebSocket protocol error: Connection reset without closing handshake)"}));
  console.log(JSON.stringify({type:"item.completed",thread_id:"root",item:{id:"message",type:"agent_message",text:jsonlOutput}}));
  console.log(JSON.stringify({type:"turn.completed",thread_id:"root",usage:{input_tokens:10,cached_input_tokens:0,output_tokens:5,reasoning_output_tokens:2}}));
});
`);
  await chmod(mockCodex, 0o755);
  await writeFile(authFile, "{}\n", { mode: 0o600 });
  const workspaceManifest = await treeManifest(sourceWorkspace);
  const role = {
    id: "web_scout",
    displayName: "Web scout",
    sandbox: "read-only",
    fingerprint: "role",
    roleText: "Stay read-only.",
    taskText: "Inspect input.txt.",
    paths: { workspace: sourceWorkspace },
    workspaceManifest,
    rubric: { version: "1", assertions: [{ id: "complete", description: "complete", kind: "output_regex", pattern: "mock complete", weight: 100, critical: true }] },
  };
  const suite = { suiteVersion: "1", baselines: { web_scout: { model: "gpt-5.6-terra", effort: "medium" } } };
  const caseInfo = makeCase({ suite, role, model: "gpt-5.6-terra", effort: "medium", repetition: 1, catalogDigest: "catalog", cliVersion: "mock", outputSchemaDigest: "schema", phase: "calibration" });
  const shared = {
    caseInfo,
    role,
    runDirectory,
    scratchRoot,
    codex: mockCodex,
    outputSchema: path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "schemas", "output.schema.json"),
    timeoutMs: 5000,
    commandTimeoutMs: 5000,
    suiteRoot: root,
    authFile,
    allowMockCodex: true,
  };
  const first = await runCase({ ...shared, attempt: 1 });
  const second = await runCase({ ...shared, attempt: 2 });
  const firstStderr = await readFile(path.join(first.artifactDirectory, "stderr.log"), "utf8");
  assert.equal(first.status, "passed", JSON.stringify({ harnessErrors: first.harnessErrors, process: first.process, outputErrors: first.outputErrors, stderr: firstStderr }));
  assert.equal(first.gatePass, true);
  assert.equal(first.scoringComplete, true);
  assert.equal(first.qualityPass, true);
  assert.deepEqual(first.noncriticalFailures, []);
  assert.equal(first.output.summary, "mock complete");
  assert.equal(first.outputSource, "output_last_message_file");
  assert.equal(first.metrics.childTurnFailed, 1);
  assert.equal(first.metrics.fatalRootErrors.length, 0);
  assert.equal(first.metrics.recoveredTransportWarnings.length, 1);
  assert.equal(first.harnessPass, true);
  assert.equal(first.isolation.hiddenEvaluationMaterialMounted, false);
  assert.equal(first.isolation.candidateShellAuthPath, "not-mounted");
  assert.equal(first.isolation.candidateShellBoundary, "nested-bubblewrap-mount-namespace");
  assert.match(first.isolation.fixtureRuntime.node, /^v22[.]/);
  assert.match(first.isolation.fixtureRuntime.npm, /^\d+[.]\d+[.]\d+/);
  assert.equal(first.workspace.gitBaseline.branch, "main");
  assert.match(first.workspace.gitBaseline.revision, /^[0-9a-f]{40}$/);
  assert.deepEqual(first.workspace.changedPaths, []);
  assert.equal(second.attempt, 2);
  assert.notEqual(first.artifactDirectory, second.artifactDirectory);
  const requestText = await readFile(path.join(first.artifactDirectory, "request.json"), "utf8");
  assert.doesNotMatch(requestText, new RegExp(authFile.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(requestText, /--ephemeral/);
  assert.match(requestText, /"suiteMounted": false/);
  assert.match(requestText, /"sessionState": "namespace-local-tmpfs-destroyed-on-exit"/);
  assert.equal(await readFile(hiddenSentinel, "utf8"), "must remain hidden\n");
});
test("terminal classification distinguishes hard gates, incomplete scoring, and quality", () => {
  assert.equal(classifyResult({ timedOut: true, harnessPass: true, gatePass: true, scoringComplete: true, qualityPass: true }), "timeout");
  assert.equal(classifyResult({ harnessPass: false, gatePass: true, scoringComplete: true, qualityPass: true }), "harness_failed");
  assert.equal(classifyResult({ harnessPass: true, gatePass: false, scoringComplete: true, qualityPass: false }), "gate_failed");
  assert.equal(classifyResult({ harnessPass: true, gatePass: true, scoringComplete: false, qualityPass: false }), "scoring_indeterminate");
  assert.equal(classifyResult({ harnessPass: true, gatePass: true, scoringComplete: true, qualityPass: false }), "quality_failed");
  assert.equal(classifyResult({ harnessPass: true, gatePass: true, scoringComplete: true, qualityPass: true }), "passed");
});

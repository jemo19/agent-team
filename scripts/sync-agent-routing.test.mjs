import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), "sync-agent-routing.mjs");
const standing = [
  "customer-comms", "default", "explorer", "iac-planner", "infra-planner",
  "infra-recon", "msp-triage", "project-architect", "project-builder",
  "project-reviewer", "risk-reviewer", "test-mapper", "test-strategist",
  "web-builder", "web-scout", "worker",
];
const variants = [
  "project-builder-high", "project-reviewer-astra-high", "web-builder-high", "web-scout-high",
];

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "agent-routing-"));
  const projectsRoot = path.join(root, "projects");
  const templatesRoot = path.join(root, "templates");
  const codexHome = path.join(root, "codex-home");
  await mkdir(path.join(projectsRoot, "alpha", ".codex"), { recursive: true });
  await mkdir(path.join(projectsRoot, "portfolio", "child"), { recursive: true });
  await mkdir(path.join(templatesRoot, "web-project", ".codex"), { recursive: true });
  await mkdir(path.join(templatesRoot, "home-codex", "agents"), { recursive: true });
  await writeFile(path.join(projectsRoot, "alpha", ".codex", "config.toml"), "# keep\n[agents]\nmax_threads = 6\nmax_depth = 1\njob_max_runtime_seconds = 1800\n\n[features]\nhooks = true\n");
  await writeFile(path.join(projectsRoot, "portfolio", "child", "AGENTS.md"), "# child\n");
  await writeFile(path.join(templatesRoot, "web-project", ".codex", "config.toml"), "[agents]\nmax_concurrent_threads_per_session = 2\n");
  for (const role of [...standing, ...variants]) {
    const name = role.replaceAll("-", "_");
    await writeFile(path.join(templatesRoot, "home-codex", "agents", `${role}.toml`), `name = "${name}"\ndescription = "fixture"\ndeveloper_instructions = "fixture"\nmodel = "fixture"\nmodel_reasoning_effort = "medium"\n`);
  }
  return { root, projectsRoot, templatesRoot, codexHome };
}

function run({ projectsRoot, templatesRoot, codexHome }, ...args) {
  return spawnSync(process.execPath, [script, ...args, "--projects-root", projectsRoot, "--templates-root", templatesRoot, "--codex-home", codexHome, "--json"], { encoding: "utf8" });
}

test("write centralizes exactly 16 standing agents and four on-demand variants", async () => {
  const context = await fixture();
  assert.equal(run(context, "--check").status, 1);
  const write = run(context, "--write");
  assert.equal(write.status, 0, write.stderr);
  const summary = JSON.parse(write.stdout);
  assert.equal(summary.projectCount, 3);
  assert.equal(summary.standingAgentCount, 16);
  assert.equal(summary.onDemandVariantCount, 4);
  assert.equal(summary.canonicalAgentCount, 20);
  const alpha = await readFile(path.join(context.projectsRoot, "alpha", ".codex", "config.toml"), "utf8");
  assert.match(alpha, /max_concurrent_threads_per_session = 2/);
  assert.match(alpha, /# keep/);
  assert.match(alpha, /\[features\]\nhooks = true/);
  assert.doesNotMatch(alpha, /max_threads|max_depth|job_max_runtime_seconds/);
  await assert.rejects(readFile(path.join(context.projectsRoot, "alpha", ".codex", "agents", "explorer.toml")));
  assert.match(await readFile(path.join(context.codexHome, "agents", "explorer.toml"), "utf8"), /name = "explorer"/);
  assert.equal(run(context, "--check").status, 0);
});

test("project-scoped agent shadows fail closed and are not deleted", async () => {
  const context = await fixture();
  run(context, "--write");
  const shadowRoot = path.join(context.projectsRoot, "alpha", ".codex", "agents");
  await mkdir(shadowRoot, { recursive: true });
  const shadow = path.join(shadowRoot, "explorer.toml");
  await writeFile(shadow, 'name = "explorer"\n');
  const result = run(context, "--write");
  assert.equal(result.status, 1);
  assert.deepEqual(JSON.parse(result.stdout).projectAgentShadows, [shadow]);
  assert.match(await readFile(shadow, "utf8"), /explorer/);
});

test("agents-only write does not inspect or modify project configuration", async () => {
  const context = await fixture();
  const config = path.join(context.projectsRoot, "alpha", ".codex", "config.toml");
  const before = await readFile(config, "utf8");
  const shadowRoot = path.join(context.projectsRoot, "alpha", ".codex", "agents");
  await mkdir(shadowRoot, { recursive: true });
  await writeFile(path.join(shadowRoot, "explorer.toml"), 'name = "explorer"\n');
  const result = run(context, "--write", "--agents-only");
  assert.equal(result.status, 0, result.stderr);
  const summary = JSON.parse(result.stdout);
  assert.equal(summary.syncScope, "agents-only");
  assert.equal(summary.projectCount, 0);
  assert.equal(summary.shadowCount, 0);
  assert.equal(await readFile(config, "utf8"), before);
  assert.equal(summary.createdCount, 20);
});

test("unexpected or missing canonical definitions fail before writes", async () => {
  const context = await fixture();
  await writeFile(path.join(context.templatesRoot, "home-codex", "agents", "unexpected.toml"), 'name = "unexpected"\n');
  const result = run(context, "--write", "--agents-only");
  assert.notEqual(result.status, 0);
  await assert.rejects(readFile(path.join(context.codexHome, "agents", "default.toml")));
});

#!/usr/bin/env node
import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const standingAgents = new Set([
  "customer-comms.toml", "default.toml", "explorer.toml", "iac-planner.toml",
  "infra-planner.toml", "infra-recon.toml", "msp-triage.toml",
  "project-architect.toml", "project-builder.toml", "project-reviewer.toml",
  "risk-reviewer.toml", "test-mapper.toml", "test-strategist.toml",
  "web-builder.toml", "web-scout.toml", "worker.toml",
]);
const onDemandVariants = new Set([
  "project-builder-high.toml", "project-reviewer-astra-high.toml",
  "web-builder-high.toml", "web-scout-high.toml",
]);
const canonicalAgents = new Set([...standingAgents, ...onDemandVariants]);
const managedAgentKeys = new Set([
  "max_threads",
  "max_depth",
  "job_max_runtime_seconds",
  "max_concurrent_threads_per_session",
]);

function parseArgs(argv) {
  const options = {
    mode: "check",
    json: false,
    agentsOnly: false,
    projectsRoot: path.join(os.homedir(), "projects"),
    templatesRoot: path.join(scriptRoot, "templates"),
    codexHome: path.join(os.homedir(), ".codex"),
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--write") options.mode = "write";
    else if (argument === "--check") options.mode = "check";
    else if (argument === "--json") options.json = true;
    else if (argument === "--agents-only") options.agentsOnly = true;
    else if (argument === "--projects-root") options.projectsRoot = path.resolve(argv[++index]);
    else if (argument === "--templates-root") options.templatesRoot = path.resolve(argv[++index]);
    else if (argument === "--codex-home") options.codexHome = path.resolve(argv[++index]);
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

async function discoverProjectRoots(projectsRoot) {
  const roots = [];
  for (const entry of await readdir(projectsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    roots.push(path.join(projectsRoot, entry.name));
  }
  const portfolioRoot = path.join(projectsRoot, "portfolio");
  if (await exists(portfolioRoot)) {
    for (const entry of await readdir(portfolioRoot, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
      const candidate = path.join(portfolioRoot, entry.name);
      if (await exists(path.join(candidate, "AGENTS.md")) || await exists(path.join(candidate, ".git"))) roots.push(candidate);
    }
  }
  return roots.sort();
}

function reconcileProjectConfig(source) {
  if (
    /^max_concurrent_threads_per_session\s*=\s*2\s*$/m.test(source) &&
    !/^(max_threads|max_depth|job_max_runtime_seconds)\s*=/m.test(source)
  ) {
    return source;
  }
  const hadFinalNewline = source.endsWith("\n");
  const lines = source.split("\n");
  if (hadFinalNewline) lines.pop();
  const sectionStart = lines.findIndex((line) => line.trim() === "[agents]");
  if (sectionStart === -1) {
    if (lines.length && lines.at(-1).trim() !== "") lines.push("");
    lines.push("[agents]", "max_concurrent_threads_per_session = 2");
  } else {
    let sectionEnd = lines.length;
    for (let index = sectionStart + 1; index < lines.length; index += 1) {
      if (/^\s*\[/.test(lines[index])) {
        sectionEnd = index;
        break;
      }
    }
    const retained = lines.slice(sectionStart + 1, sectionEnd).filter((line) => {
      const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=/);
      return !match || !managedAgentKeys.has(match[1]);
    });
    while (retained.length && retained[0].trim() === "") retained.shift();
    lines.splice(sectionStart + 1, sectionEnd - sectionStart - 1, "max_concurrent_threads_per_session = 2", ...retained);
  }
  return `${lines.join("\n")}${hadFinalNewline ? "\n" : ""}`;
}

async function reconcileProjectFile({ target, template, mode, result }) {
  if (!(await exists(target))) {
    result.missing.push(target);
    if (mode === "write") {
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, reconcileProjectConfig(await readFile(template, "utf8")), "utf8");
      result.created.push(target);
    }
    return;
  }
  const source = await readFile(target, "utf8");
  const desired = reconcileProjectConfig(source);
  if (source === desired) return;
  result.drifted.push(target);
  if (mode === "write") {
    await writeFile(target, desired, "utf8");
    result.updated.push(target);
  }
}

async function reconcileExactFile({ target, template, mode, result }) {
  const desired = await readFile(template, "utf8");
  if (!(await exists(target))) {
    result.missing.push(target);
    if (mode === "write") {
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, desired, "utf8");
      result.created.push(target);
    }
    return;
  }
  const source = await readFile(target, "utf8");
  if (source === desired) return;
  result.drifted.push(target);
  if (mode === "write") {
    await writeFile(target, desired, "utf8");
    result.updated.push(target);
  }
}

async function projectAgentShadows(root) {
  const agentsRoot = path.join(root, ".codex", "agents");
  if (!(await exists(agentsRoot))) return [];
  return (await readdir(agentsRoot, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".toml"))
    .map((entry) => path.join(agentsRoot, entry.name));
}

function classifyAgentTemplates(files) {
  const discovered = new Set(files);
  const missing = [...canonicalAgents].filter((file) => !discovered.has(file));
  const unexpected = files.filter((file) => !canonicalAgents.has(file));
  if (missing.length || unexpected.length) {
    throw new Error(`Canonical agent inventory mismatch; missing=${missing.join(",")} unexpected=${unexpected.join(",")}`);
  }
  return {
    standing: files.filter((file) => standingAgents.has(file)),
    variants: files.filter((file) => onDemandVariants.has(file)),
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const roots = options.agentsOnly ? [] : await discoverProjectRoots(options.projectsRoot);
  const result = {
    mode: options.mode,
    syncScope: options.agentsOnly ? "agents-only" : "all",
    projectsRoot: options.projectsRoot,
    codexHome: options.codexHome,
    projectCount: roots.length,
    created: [], updated: [], missing: [], drifted: [], projectAgentShadows: [],
  };
  if (!options.agentsOnly) {
    const projectConfigTemplate = path.join(options.templatesRoot, "web-project", ".codex", "config.toml");
    for (const root of roots) {
      await reconcileProjectFile({ target: path.join(root, ".codex", "config.toml"), template: projectConfigTemplate, mode: options.mode, result });
      result.projectAgentShadows.push(...(await projectAgentShadows(root)));
    }
  }
  const agentTemplateRoot = path.join(options.templatesRoot, "home-codex", "agents");
  const agentTemplates = (await readdir(agentTemplateRoot, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".toml"))
    .map((entry) => entry.name)
    .sort();
  const classified = classifyAgentTemplates(agentTemplates);
  for (const file of agentTemplates) {
    await reconcileExactFile({ target: path.join(options.codexHome, "agents", file), template: path.join(agentTemplateRoot, file), mode: options.mode, result });
  }
  const unresolved = (options.mode === "check" ? result.missing.length + result.drifted.length : 0) + result.projectAgentShadows.length;
  const summary = {
    ...result,
    ok: unresolved === 0,
    createdCount: result.created.length,
    updatedCount: result.updated.length,
    missingCount: result.missing.length,
    driftedCount: result.drifted.length,
    shadowCount: result.projectAgentShadows.length,
    standingAgentCount: classified.standing.length,
    onDemandVariantCount: classified.variants.length,
    canonicalAgentCount: agentTemplates.length,
  };
  if (options.json) console.log(JSON.stringify(summary, null, 2));
  else {
    console.log(`${options.mode}/${summary.syncScope}: ${roots.length} project roots; ${summary.standingAgentCount} standing agents + ${summary.onDemandVariantCount} on-demand variants`);
    console.log(`created=${summary.createdCount} updated=${summary.updatedCount} missing=${summary.missingCount} drifted=${summary.driftedCount} project-agent-shadows=${summary.shadowCount}`);
  }
  if (!summary.ok) process.exitCode = 1;
}

await main();

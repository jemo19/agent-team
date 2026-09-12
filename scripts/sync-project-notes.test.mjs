#!/usr/bin/env node
import assert from "node:assert/strict";
import { chmod, mkdtemp, mkdir, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const script = path.join(repoRoot, "scripts", "sync-project-notes.mjs");

function run(args) {
  return spawnSync(process.execPath, [script, ...args], { encoding: "utf8" });
}

async function fixture(prefix = "project-notes-") {
  const root = await mkdtemp(path.join(os.tmpdir(), prefix));
  const projectsRoot = path.join(root, "projects");
  const docsBase = path.join(root, "docs");
  await mkdir(projectsRoot);
  await mkdir(docsBase);
  return { root, projectsRoot, docsBase };
}

function commonArgs({ projectsRoot, docsBase }) {
  return ["--projects-root", projectsRoot, "--docs-base", docsBase];
}

test("writes immediate projects, preserves AGENTS content, configures writable roots, and is idempotent", async () => {
  const context = await fixture();
  try {
    const alpha = path.join(context.projectsRoot, "alpha");
    const beta = path.join(context.projectsRoot, "beta");
    const portfolio = path.join(context.projectsRoot, "portfolio");
    await mkdir(path.join(alpha, ".codex"), { recursive: true });
    await mkdir(beta);
    await mkdir(path.join(portfolio, "nested-child"), { recursive: true });
    await mkdir(path.join(context.projectsRoot, ".hidden"));
    await writeFile(path.join(alpha, "AGENTS.md"), "# Alpha\n\nKeep this custom instruction.\n", "utf8");
    await writeFile(path.join(alpha, ".codex", "config.toml"), '[features]\ncustom = true\n', "utf8");
    await chmod(path.join(alpha, "AGENTS.md"), 0o640);
    await chmod(path.join(alpha, ".codex", "config.toml"), 0o640);
    const legacyRoot = path.join(context.root, "old-alpha-notes");
    const legacyMap = JSON.stringify({ alpha: [legacyRoot] });

    const check = run(["--check", "--json", ...commonArgs(context), "--legacy-map", legacyMap]);
    assert.equal(check.status, 1, check.stderr);
    const checkResult = JSON.parse(check.stdout);
    assert.equal(checkResult.projectCount, 3);
    assert.equal(checkResult.configDriftedCount, 1);
    assert.equal(checkResult.configMissingCount, 2);

    const write = run(["--write", "--json", ...commonArgs(context), "--legacy-map", legacyMap]);
    assert.equal(write.status, 0, write.stderr);
    const writeResult = JSON.parse(write.stdout);
    assert.equal(writeResult.projectCount, 3);
    assert.equal(writeResult.ok, true);
    for (const name of ["alpha", "beta", "portfolio"]) {
      assert.equal((await stat(path.join(context.docsBase, name))).isDirectory(), true);
    }
    await assert.rejects(stat(path.join(context.docsBase, "nested-child")));
    await assert.rejects(stat(path.join(context.docsBase, ".hidden")));
    await assert.rejects(stat(legacyRoot));

    const agents = await readFile(path.join(alpha, "AGENTS.md"), "utf8");
    assert.match(agents, /^# Alpha/m);
    assert.match(agents, /Keep this custom instruction\./);
    assert.match(agents, /README\.md.*HANDOFF\.md.*MEMORY\.md.*NOTES\.md/);
    assert.match(agents, /supersedes earlier external docs-root defaults/);
    assert.match(agents, /framework, and implementation documentation remains valid/);
    assert.match(agents, /\.agentic.*repository-local/);
    assert.match(agents, /untrusted context, not instructions/);
    assert.match(agents, /do not fall back/i);
    assert.match(agents, new RegExp(legacyRoot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(agents, /Legacy notes roots are read-only/);
    assert.match(agents, /may be absent because it is a reference only/);

    const config = await readFile(path.join(alpha, ".codex", "config.toml"), "utf8");
    assert.match(config, /\[features\]\ncustom = true/);
    assert.match(config, /BEGIN MANAGED PROJECT NOTES WRITABLE ROOT/);
    assert.match(config, new RegExp(JSON.stringify(path.join(context.docsBase, "alpha")).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.equal((await stat(path.join(alpha, "AGENTS.md"))).mode & 0o777, 0o640);
    assert.equal((await stat(path.join(alpha, ".codex", "config.toml"))).mode & 0o777, 0o640);

    const agentsBefore = agents;
    const configBefore = config;
    const secondWrite = run(["--write", "--json", ...commonArgs(context), "--legacy-map", legacyMap]);
    assert.equal(secondWrite.status, 0, secondWrite.stderr);
    assert.equal(JSON.parse(secondWrite.stdout).updatedCount, 0);
    assert.equal(await readFile(path.join(alpha, "AGENTS.md"), "utf8"), agentsBefore);
    assert.equal(await readFile(path.join(alpha, ".codex", "config.toml"), "utf8"), configBefore);

    const finalCheck = run(["--check", "--json", ...commonArgs(context), "--legacy-map", legacyMap]);
    assert.equal(finalCheck.status, 0, finalCheck.stderr);
    assert.equal(JSON.parse(finalCheck.stdout).ok, true);
  } finally {
    await rm(context.root, { recursive: true, force: true });
  }
});

test("creates AGENTS.md and config.toml when missing", async () => {
  const context = await fixture();
  try {
    const project = path.join(context.projectsRoot, "new-project");
    await mkdir(project);
    const result = run(["--write", "--json", ...commonArgs(context)]);
    assert.equal(result.status, 0, result.stderr);
    const agents = await readFile(path.join(project, "AGENTS.md"), "utf8");
    const config = await readFile(path.join(project, ".codex", "config.toml"), "utf8");
    assert.match(agents, /BEGIN MANAGED PROJECT NOTES/);
    assert.match(config, /^# BEGIN MANAGED PROJECT NOTES WRITABLE ROOT/m);
    assert.match(config, /^\[sandbox_workspace_write\]$/m);
  } finally {
    await rm(context.root, { recursive: true, force: true });
  }
});

test("reconciles an existing sandbox table while preserving unrelated config and writable roots", async () => {
  const context = await fixture();
  try {
    const project = path.join(context.projectsRoot, "configured");
    await mkdir(path.join(project, ".codex"), { recursive: true });
    const existingRoot = path.join(context.root, "existing-write-root");
    await writeFile(
      path.join(project, ".codex", "config.toml"),
      `model = "example"\n\n[sandbox_workspace_write] # keep table\nwritable_roots = [${JSON.stringify(existingRoot)}]\nnetwork_access = false\n\n[features]\ncustom = true\n`,
      "utf8",
    );
    const result = run(["--write", "--json", ...commonArgs(context)]);
    assert.equal(result.status, 0, result.stderr);
    const config = await readFile(path.join(project, ".codex", "config.toml"), "utf8");
    assert.equal((config.match(/\[sandbox_workspace_write\]/g) ?? []).length, 1);
    assert.doesNotMatch(config, /BEGIN MANAGED PROJECT NOTES WRITABLE ROOT/);
    assert.match(config, new RegExp(existingRoot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(config, new RegExp(path.join(context.docsBase, "configured").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(config, /network_access = false/);
    assert.match(config, /\[features\]\ncustom = true/);
    const check = run(["--check", "--json", ...commonArgs(context)]);
    assert.equal(check.status, 0, check.stderr);
  } finally {
    await rm(context.root, { recursive: true, force: true });
  }
});

test("fails visibly and makes no fallback when the docs base is missing", async () => {
  const context = await fixture();
  try {
    const project = path.join(context.projectsRoot, "alpha");
    const missingDocsBase = path.join(context.root, "unmounted-docs");
    await mkdir(project);
    const result = run(["--write", "--json", "--projects-root", context.projectsRoot, "--docs-base", missingDocsBase]);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /Docs base does not exist/);
    await assert.rejects(readFile(path.join(project, "AGENTS.md"), "utf8"));
  } finally {
    await rm(context.root, { recursive: true, force: true });
  }
});

test("requires an explicit docs base", () => {
  const result = run(["--check"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /--docs-base is required/);
});

test("rejects a notes-directory symlink that resolves outside the docs base", async () => {
  const context = await fixture();
  try {
    const project = path.join(context.projectsRoot, "escape");
    const outside = path.join(context.root, "outside");
    await mkdir(project);
    await mkdir(outside);
    await symlink(outside, path.join(context.docsBase, "escape"));
    const result = run(["--write", "--json", ...commonArgs(context)]);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /Resolved notes target escapes docs base/);
    await assert.rejects(readFile(path.join(project, "AGENTS.md"), "utf8"));
  } finally {
    await rm(context.root, { recursive: true, force: true });
  }
});

test("preflight rejects symlinked AGENTS.md, .codex, and config.toml targets", async (t) => {
  const cases = [
    {
      name: "AGENTS.md",
      message: /AGENTS\.md must not be a symlink/,
      setup: async ({ project, outside }) => {
        const external = path.join(outside, "AGENTS.md");
        await writeFile(external, "outside agents\n", "utf8");
        await symlink(external, path.join(project, "AGENTS.md"));
        return external;
      },
    },
    {
      name: ".codex directory",
      message: /\.codex directory must not be a symlink/,
      setup: async ({ project, outside }) => {
        const external = path.join(outside, "codex");
        await mkdir(external);
        await symlink(external, path.join(project, ".codex"));
        return external;
      },
    },
    {
      name: "config.toml",
      message: /config\.toml must not be a symlink/,
      setup: async ({ project, outside }) => {
        await mkdir(path.join(project, ".codex"));
        const external = path.join(outside, "config.toml");
        await writeFile(external, "model = 'outside'\n", "utf8");
        await symlink(external, path.join(project, ".codex", "config.toml"));
        return external;
      },
    },
  ];

  for (const scenario of cases) {
    await t.test(scenario.name, async () => {
      const context = await fixture();
      try {
        const project = path.join(context.projectsRoot, "alpha");
        const outside = path.join(context.root, "outside");
        await mkdir(project);
        await mkdir(outside);
        const external = await scenario.setup({ project, outside });
        const before = (await stat(external)).isFile() ? await readFile(external, "utf8") : undefined;
        const result = run(["--write", "--json", ...commonArgs(context)]);
        assert.equal(result.status, 2);
        assert.match(result.stderr, scenario.message);
        await assert.rejects(stat(path.join(context.docsBase, "alpha")));
        if (before !== undefined) assert.equal(await readFile(external, "utf8"), before);
      } finally {
        await rm(context.root, { recursive: true, force: true });
      }
    });
  }
});

test("preflights every project before making any change", async () => {
  const context = await fixture();
  try {
    const alpha = path.join(context.projectsRoot, "alpha");
    const zulu = path.join(context.projectsRoot, "zulu");
    await mkdir(path.join(alpha, ".codex"), { recursive: true });
    await mkdir(zulu);
    const alphaAgents = "# Alpha custom\n";
    const alphaConfig = "model = 'keep-me'\n";
    await writeFile(path.join(alpha, "AGENTS.md"), alphaAgents, "utf8");
    await writeFile(path.join(alpha, ".codex", "config.toml"), alphaConfig, "utf8");
    await writeFile(path.join(zulu, "AGENTS.md"), "<!-- BEGIN MANAGED PROJECT NOTES -->\nmalformed\n", "utf8");

    const result = run(["--write", ...commonArgs(context)]);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /Malformed or duplicate AGENTS\.md project-notes managed markers/);
    assert.equal(await readFile(path.join(alpha, "AGENTS.md"), "utf8"), alphaAgents);
    assert.equal(await readFile(path.join(alpha, ".codex", "config.toml"), "utf8"), alphaConfig);
    await assert.rejects(stat(path.join(context.docsBase, "alpha")));
    await assert.rejects(stat(path.join(context.docsBase, "zulu")));
  } finally {
    await rm(context.root, { recursive: true, force: true });
  }
});

test("rejects colliding basenames before writing", async () => {
  const context = await fixture();
  try {
    await mkdir(path.join(context.projectsRoot, "Same"));
    await mkdir(path.join(context.projectsRoot, "same"));
    const result = run(["--write", "--json", ...commonArgs(context)]);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /Duplicate project basenames collide/);
    await assert.rejects(stat(path.join(context.docsBase, "Same")));
  } finally {
    await rm(context.root, { recursive: true, force: true });
  }
});

test("validates legacy map shape, absolute roots, project names, and collisions", async () => {
  const context = await fixture();
  try {
    await mkdir(path.join(context.projectsRoot, "alpha"));
    const invalidCases = [
      ["[]", /must be a JSON object/],
      [JSON.stringify({ alpha: "not-an-array" }), /must be an array/],
      [JSON.stringify({ alpha: ["relative/path"] }), /must be an absolute path/],
      [JSON.stringify({ unknown: [path.join(context.root, "old")] }), /unknown project basename/],
      [JSON.stringify({ alpha: [path.join(context.docsBase, "alpha")] }), /collides with the writable notes root/],
    ];
    for (const [legacyMap, message] of invalidCases) {
      const result = run(["--check", ...commonArgs(context), "--legacy-map", legacyMap]);
      assert.equal(result.status, 2, `${legacyMap}: ${result.stderr}`);
      assert.match(result.stderr, message);
    }
  } finally {
    await rm(context.root, { recursive: true, force: true });
  }
});

test("reads a legacy map file and rejects using both legacy-map interfaces", async () => {
  const context = await fixture();
  try {
    await mkdir(path.join(context.projectsRoot, "alpha"));
    const legacyRoot = path.join(context.root, "old-alpha");
    const mapFile = path.join(context.root, "legacy-map.json");
    await writeFile(mapFile, JSON.stringify({ alpha: [legacyRoot] }), "utf8");

    const write = run(["--write", "--json", ...commonArgs(context), "--legacy-map-file", mapFile]);
    assert.equal(write.status, 0, write.stderr);
    const agents = await readFile(path.join(context.projectsRoot, "alpha", "AGENTS.md"), "utf8");
    assert.match(agents, new RegExp(legacyRoot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    await assert.rejects(stat(legacyRoot));

    const conflict = run([
      "--check",
      ...commonArgs(context),
      "--legacy-map",
      "{}",
      "--legacy-map-file",
      mapFile,
    ]);
    assert.equal(conflict.status, 2);
    assert.match(conflict.stderr, /mutually exclusive/);
  } finally {
    await rm(context.root, { recursive: true, force: true });
  }
});

test("rejects legacy symlink aliases after resolving real paths", async () => {
  const writableContext = await fixture("legacy-writable-alias-");
  try {
    await mkdir(path.join(writableContext.projectsRoot, "alpha"));
    const writableRoot = path.join(writableContext.docsBase, "alpha");
    const alias = path.join(writableContext.root, "writable-alias");
    await mkdir(writableRoot);
    await symlink(writableRoot, alias);
    const result = run([
      "--check",
      ...commonArgs(writableContext),
      "--legacy-map",
      JSON.stringify({ alpha: [alias] }),
    ]);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /Resolved legacy root.*collides with the writable notes root/);
  } finally {
    await rm(writableContext.root, { recursive: true, force: true });
  }

  const legacyContext = await fixture("legacy-legacy-alias-");
  try {
    await mkdir(path.join(legacyContext.projectsRoot, "alpha"));
    const legacyRoot = path.join(legacyContext.root, "legacy");
    const alias = path.join(legacyContext.root, "legacy-alias");
    await mkdir(legacyRoot);
    await symlink(legacyRoot, alias);
    const result = run([
      "--check",
      ...commonArgs(legacyContext),
      "--legacy-map",
      JSON.stringify({ alpha: [legacyRoot, alias] }),
    ]);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /Resolved legacy roots collide/);
  } finally {
    await rm(legacyContext.root, { recursive: true, force: true });
  }
});

test("applies four renamed mappings and one pointer-only canonical sharing exception", async () => {
  const context = await fixture("confirmed-mappings-");
  try {
    const renamed = new Map([
      ["agent-team", "ai-teams"],
      ["infra-code", "infrastructure"],
      ["site-old", "site-canonical"],
      ["ops-local", "operations"],
    ]);
    for (const name of [...renamed.keys(), "wow", "wow-ai"]) {
      await mkdir(path.join(context.projectsRoot, name));
    }

    const mapping = {};
    for (const [project, canonicalName] of renamed) {
      mapping[project] = {
        canonical: path.join(context.docsBase, canonicalName),
        compatibility_index: path.join(context.docsBase, project),
      };
    }
    mapping.wow = {
      canonical: path.join(context.docsBase, "wow-ai"),
      compatibility_index: path.join(context.docsBase, "wow"),
      pointer_only: true,
    };
    const preservedWritableRoot = path.join(context.root, "preserved-writable-root");
    await mkdir(path.join(context.projectsRoot, "wow", ".codex"));
    await writeFile(
      path.join(context.projectsRoot, "wow", ".codex", "config.toml"),
      `[sandbox_workspace_write]\nwritable_roots = [${JSON.stringify(mapping.wow.compatibility_index)}, ${JSON.stringify(preservedWritableRoot)}]\n`,
      "utf8",
    );
    await mkdir(path.join(context.projectsRoot, "wow-ai", ".codex"));
    await writeFile(
      path.join(context.projectsRoot, "wow-ai", ".codex", "config.toml"),
      `[sandbox_workspace_write]\nwritable_roots = [${JSON.stringify(mapping.wow.compatibility_index)}]\n`,
      "utf8",
    );
    const mappingFile = path.join(context.root, "confirmed-mappings.json");
    await writeFile(mappingFile, JSON.stringify(mapping), "utf8");

    const write = run(["--write", "--json", ...commonArgs(context), "--mapping-file", mappingFile]);
    assert.equal(write.status, 0, write.stderr);
    const summary = JSON.parse(write.stdout);
    assert.equal(summary.projectCount, 6);
    assert.equal(summary.notes.created.length, 5);

    for (const [project, canonicalName] of renamed) {
      const canonical = path.join(context.docsBase, canonicalName);
      const compatibility = path.join(context.docsBase, project);
      assert.equal((await stat(canonical)).isDirectory(), true);
      await assert.rejects(stat(compatibility));
      const agents = await readFile(path.join(context.projectsRoot, project, "AGENTS.md"), "utf8");
      const config = await readFile(path.join(context.projectsRoot, project, ".codex", "config.toml"), "utf8");
      assert.match(agents, new RegExp(canonical.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      assert.match(agents, /compatibility index.*reference-only.*not a writable authority/i);
      assert.match(config, new RegExp(JSON.stringify(canonical).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      assert.doesNotMatch(config, new RegExp(JSON.stringify(compatibility).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }

    const wowCanonical = path.join(context.docsBase, "wow-ai");
    const wowCompatibility = path.join(context.docsBase, "wow");
    assert.equal((await stat(wowCanonical)).isDirectory(), true);
    await assert.rejects(stat(wowCompatibility));
    const wowAgents = await readFile(path.join(context.projectsRoot, "wow", "AGENTS.md"), "utf8");
    const wowConfig = await readFile(path.join(context.projectsRoot, "wow", ".codex", "config.toml"), "utf8");
    assert.match(wowAgents, /local project `wow` is a compatibility pointer to the canonical project/i);
    assert.match(wowAgents, /must not create or use a competing notes tree/i);
    assert.match(wowAgents, new RegExp(wowCanonical.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(wowConfig, new RegExp(JSON.stringify(wowCanonical).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.doesNotMatch(wowConfig, new RegExp(JSON.stringify(wowCompatibility).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(wowConfig, new RegExp(JSON.stringify(preservedWritableRoot).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    const wowAiConfig = await readFile(path.join(context.projectsRoot, "wow-ai", ".codex", "config.toml"), "utf8");
    assert.match(wowAiConfig, new RegExp(JSON.stringify(wowCanonical).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.doesNotMatch(wowAiConfig, new RegExp(JSON.stringify(wowCompatibility).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

    const check = run(["--check", "--json", ...commonArgs(context), "--mapping-file", mappingFile]);
    assert.equal(check.status, 0, check.stderr);
    assert.equal(JSON.parse(check.stdout).ok, true);
  } finally {
    await rm(context.root, { recursive: true, force: true });
  }
});

test("mapping validation rejects malformed, unknown, escaping, and invalid canonical collisions before writing", async () => {
  const cases = [
    {
      name: "malformed value",
      projects: ["alpha"],
      mapping: { alpha: [] },
      message: /Mapping for alpha must be an object/,
    },
    {
      name: "unknown project",
      projects: ["alpha"],
      mapping: { unknown: { canonical: "CANONICAL" } },
      message: /unknown project basename/,
    },
    {
      name: "escaping canonical",
      projects: ["alpha"],
      mapping: { alpha: { canonical: "OUTSIDE" } },
      message: /canonical for alpha escapes docs base/,
    },
    {
      name: "two writable authorities",
      projects: ["alpha", "beta"],
      mapping: {
        alpha: { canonical: "CANONICAL" },
        beta: { canonical: "CANONICAL" },
      },
      message: /sharing requires exactly one pointer_only project and one canonical project participant/,
    },
  ];

  for (const scenario of cases) {
    const context = await fixture(`invalid-mapping-${scenario.name.replace(/\s+/g, "-")}-`);
    try {
      for (const name of scenario.projects) await mkdir(path.join(context.projectsRoot, name));
      const canonical = path.join(context.docsBase, "shared-canonical");
      const outside = path.join(context.root, "outside-canonical");
      const mapping = JSON.parse(
        JSON.stringify(scenario.mapping).replaceAll("CANONICAL", canonical).replaceAll("OUTSIDE", outside),
      );
      const mappingFile = path.join(context.root, "invalid-mapping.json");
      await writeFile(mappingFile, JSON.stringify(mapping), "utf8");
      const result = run(["--write", ...commonArgs(context), "--mapping-file", mappingFile]);
      assert.equal(result.status, 2, `${scenario.name}: ${result.stderr}`);
      assert.match(result.stderr, scenario.message);
      for (const name of scenario.projects) {
        await assert.rejects(stat(path.join(context.projectsRoot, name, "AGENTS.md")));
      }
      await assert.rejects(stat(canonical));
    } finally {
      await rm(context.root, { recursive: true, force: true });
    }
  }
});

test("mapping validation rejects canonical and compatibility symlink conflicts", async () => {
  const outsideContext = await fixture("mapping-symlink-escape-");
  try {
    await mkdir(path.join(outsideContext.projectsRoot, "alpha"));
    const outside = path.join(outsideContext.root, "outside");
    const aliasParent = path.join(outsideContext.docsBase, "canonical-alias");
    const canonical = path.join(aliasParent, "missing-canonical-child");
    await mkdir(outside);
    await symlink(outside, aliasParent);
    const mappingFile = path.join(outsideContext.root, "mapping.json");
    await writeFile(mappingFile, JSON.stringify({ alpha: { canonical } }), "utf8");
    const result = run(["--write", ...commonArgs(outsideContext), "--mapping-file", mappingFile]);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /Resolved notes target escapes docs base/);
    await assert.rejects(stat(path.join(outsideContext.projectsRoot, "alpha", "AGENTS.md")));
    await assert.rejects(stat(path.join(outside, "missing-canonical-child")));
  } finally {
    await rm(outsideContext.root, { recursive: true, force: true });
  }

  const compatibilityContext = await fixture("mapping-symlink-conflict-");
  try {
    await mkdir(path.join(compatibilityContext.projectsRoot, "alpha"));
    const canonical = path.join(compatibilityContext.docsBase, "canonical");
    const compatibility = path.join(compatibilityContext.docsBase, "compatibility");
    await mkdir(canonical);
    await symlink(canonical, compatibility);
    const mappingFile = path.join(compatibilityContext.root, "mapping.json");
    await writeFile(
      mappingFile,
      JSON.stringify({ alpha: { canonical, compatibility_index: compatibility } }),
      "utf8",
    );
    const result = run(["--write", ...commonArgs(compatibilityContext), "--mapping-file", mappingFile]);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /Symlink-conflicting compatibility index/);
    await assert.rejects(stat(path.join(compatibilityContext.projectsRoot, "alpha", "AGENTS.md")));
  } finally {
    await rm(compatibilityContext.root, { recursive: true, force: true });
  }
});

test("rejects malformed managed markers instead of overwriting custom files", async () => {
  const context = await fixture();
  try {
    const project = path.join(context.projectsRoot, "alpha");
    await mkdir(project);
    const original = "# Custom\n\n<!-- BEGIN MANAGED PROJECT NOTES -->\nunfinished\n";
    await writeFile(path.join(project, "AGENTS.md"), original, "utf8");
    const result = run(["--write", ...commonArgs(context)]);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /Malformed or duplicate AGENTS\.md project-notes managed markers/);
    assert.equal(await readFile(path.join(project, "AGENTS.md"), "utf8"), original);
  } finally {
    await rm(context.root, { recursive: true, force: true });
  }
});

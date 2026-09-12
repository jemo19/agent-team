import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { extractManagedBlock, reconcileManagedBlock, synchronizeSharedInvariants } from "./sync-shared-invariants.mjs";

const begin = "<!-- BEGIN SHARED EXECUTION INVARIANTS -->";
const end = "<!-- END SHARED EXECUTION INVARIANTS -->";

test("extracts and reconciles exactly one managed block", () => {
  const desired = `${begin}\nnew policy\n${end}`;
  const source = `# Project\n\n${begin}\nold policy\n${end}\n\n## Keep\nlocal rules\n`;
  assert.equal(extractManagedBlock(desired), desired);
  assert.equal(reconcileManagedBlock(source, desired), `# Project\n\n${desired}\n\n## Keep\nlocal rules\n`);
  assert.equal(reconcileManagedBlock("# Unmanaged\n", desired), null);
  assert.throws(() => reconcileManagedBlock(`${begin}\nmissing end\n`, desired), /exactly one ordered/);
});
test("check and write preserve local rules and skip hidden projects", async () => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "shared-invariants-test-"));
  try {
    const projectsRoot = path.join(temporaryRoot, "projects");
    const template = path.join(temporaryRoot, "template.md");
    const desired = `${begin}\n## Shared\n\n- new\n${end}`;
    await mkdir(path.join(projectsRoot, "alpha"), { recursive: true });
    await mkdir(path.join(projectsRoot, "beta"), { recursive: true });
    await mkdir(path.join(projectsRoot, "gamma"), { recursive: true });
    await mkdir(path.join(projectsRoot, ".archive", "old"), { recursive: true });
    await writeFile(template, `# Template\n\n${desired}\n`, "utf8");
    await writeFile(path.join(projectsRoot, "alpha", "AGENTS.md"), `# Alpha\n\n${begin}\nold\n${end}\n\n## Local\nkeep me\n`, "utf8");
    await writeFile(path.join(projectsRoot, "beta", "AGENTS.md"), `# Beta\n\n${desired}\n`, "utf8");
    await writeFile(path.join(projectsRoot, "gamma", "AGENTS.md"), "# Unmanaged\n", "utf8");
    await writeFile(path.join(projectsRoot, ".archive", "old", "AGENTS.md"), `${begin}\narchived\n${end}\n`, "utf8");

    const check = await synchronizeSharedInvariants({ mode: "check", projectsRoot, template });
    assert.equal(check.discoveredCount, 3);
    assert.equal(check.managedCount, 2);
    assert.equal(check.unmanagedCount, 1);
    assert.deepEqual(check.drifted, [path.join(projectsRoot, "alpha", "AGENTS.md")]);
    assert.equal(check.ok, false);

    const write = await synchronizeSharedInvariants({ mode: "write", projectsRoot, template });
    assert.equal(write.updatedCount, 1);
    assert.equal(write.ok, true);
    assert.match(await readFile(path.join(projectsRoot, "alpha", "AGENTS.md"), "utf8"), /## Local\nkeep me/);
    assert.match(await readFile(path.join(projectsRoot, ".archive", "old", "AGENTS.md"), "utf8"), /archived/);

    const finalCheck = await synchronizeSharedInvariants({ mode: "check", projectsRoot, template });
    assert.equal(finalCheck.ok, true);
    assert.equal(finalCheck.driftedCount, 0);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("targets file updates only reviewed active paths", async () => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "shared-invariants-targets-test-"));
  try {
    const projectsRoot = path.join(temporaryRoot, "projects");
    const template = path.join(temporaryRoot, "template.md");
    const targetsFile = path.join(temporaryRoot, "targets.txt");
    const desired = `${begin}\nselected policy\n${end}`;
    const selected = path.join(projectsRoot, "active", "AGENTS.md");
    const archived = path.join(projectsRoot, "archive", "AGENTS.md");
    await mkdir(path.dirname(selected), { recursive: true });
    await mkdir(path.dirname(archived), { recursive: true });
    await writeFile(template, desired, "utf8");
    await writeFile(selected, `${begin}\nold active\n${end}\n`, "utf8");
    await writeFile(archived, `${begin}\nold archive\n${end}\n`, "utf8");
    await writeFile(targetsFile, `${selected}\n`, "utf8");

    const write = await synchronizeSharedInvariants({ mode: "write", projectsRoot, template, targetsFile });
    assert.equal(write.selectionMode, "targets-file");
    assert.deepEqual(write.discovered, [selected]);
    assert.equal(write.updatedCount, 1);
    assert.match(await readFile(selected, "utf8"), /selected policy/);
    assert.match(await readFile(archived, "utf8"), /old archive/);

    await writeFile(targetsFile, `${selected}\n${selected}\n`, "utf8");
    await assert.rejects(
      synchronizeSharedInvariants({ mode: "check", projectsRoot, template, targetsFile }),
      /duplicate target/,
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

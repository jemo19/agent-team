import assert from "node:assert/strict";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { captureRuntimeIdentity, validateIsolationEnvironment } from "../lib/isolation.mjs";

test("non-billed isolation preflight separates structural readiness from auth", async () => {
  const result = await validateIsolationEnvironment({ requireAuth: false });
  assert.equal(result.structural.pass, true, result.structural.errors.join("; "));
  assert.equal(result.structural.bubblewrap.pass, true);
  assert.match(result.structural.codexRuntime.version, /^codex-cli /);
  assert.equal(result.structural.fixtureRuntime.pass, true);
  assert.equal(result.structural.fixtureRuntime.nodeMajor, 22);
  assert.match(result.structural.fixtureRuntime.npm, /^\d+[.]\d+[.]\d+/);
  assert.equal(result.structural.graderNamespace.network, "unshared");
  assert.equal(result.structural.candidateCommandNamespace.authPath, "not-mounted");
  assert.equal(result.structural.candidateCommandNamespace.workspace, "bounded");
  assert.equal(result.pass, true);
});

test("auth-required preflight rejects missing credentials without reading them", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ai-team-auth-probe-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const missing = await validateIsolationEnvironment({ authFile: path.join(root, "missing.json"), requireAuth: true });
  assert.equal(missing.structural.pass, true, missing.structural.errors.join("; "));
  assert.equal(missing.authentication.present, false);
  assert.equal(missing.pass, false);

  const auth = path.join(root, "auth.json");
  await writeFile(auth, "synthetic-not-a-real-credential\n", { mode: 0o600 });
  await chmod(auth, 0o600);
  const present = await validateIsolationEnvironment({ authFile: auth, requireAuth: true });
  assert.equal(present.authentication.metadataValid, true);
  assert.equal(present.pass, true, present.structural.errors.join("; "));
});

test("runtime identity freezes Codex, Bubblewrap, Node, and npm binaries", async () => {
  const identity = await captureRuntimeIdentity();
  assert.match(identity.digest, /^[0-9a-f]{64}$/);
  assert.match(identity.bubblewrap.version, /bubblewrap/i);
  assert.match(identity.bubblewrap.sha256, /^[0-9a-f]{64}$/);
  assert.match(identity.codex.version, /^codex-cli /);
  assert.match(identity.codex.sha256, /^[0-9a-f]{64}$/);
  assert.match(identity.node.version, /^v22[.]/);
  assert.match(identity.node.sha256, /^[0-9a-f]{64}$/);
  assert.match(identity.npm.version, /^\d+[.]\d+[.]\d+/);
  assert.match(identity.npm.sha256, /^[0-9a-f]{64}$/);
});

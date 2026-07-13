import { sha256, stableStringify } from "./common.mjs";
import { runProcess } from "./process.mjs";

export function semanticRuntimeEnvironment(source = process.env) {
  const output = {};
  for (const key of ["HOME", "CODEX_HOME", "PATH", "LANG", "LC_ALL", "TMPDIR", "SSL_CERT_FILE", "SSL_CERT_DIR", "HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "NO_PROXY"]) {
    if (source[key] !== undefined) output[key] = source[key];
  }
  output.CODEX_DISABLE_GLOBAL_BYPASS = "1";
  return output;
}

export async function loadSemanticModelCatalog(codex = "codex", processRunner = runProcess) {
  const result = await processRunner(codex, ["debug", "models", "--bundled"], {
    env: semanticRuntimeEnvironment(),
    timeoutMs: 30_000,
    captureLimit: 16 * 1024 * 1024,
  });
  if (result.code !== 0 || result.timedOut || result.spawnError) {
    throw new Error(`bundled model catalog failed: ${result.spawnError ?? result.stderr.trim() ?? result.code}`);
  }
  let raw;
  try { raw = JSON.parse(result.stdout); } catch (error) { throw new Error(`bundled model catalog is invalid JSON: ${error.message}`); }
  const models = (raw.models ?? []).map((model) => ({
    slug: model.slug,
    supportedInApi: model.supported_in_api === true,
    efforts: (model.supported_reasoning_levels ?? []).map((entry) => entry.effort),
  }));
  return { source: "bundled", models, digest: sha256(stableStringify(models)) };
}

export function parseChatGptLoginStatus(stdout, stderr = "") {
  const text = `${stdout ?? ""}\n${stderr ?? ""}`
    .replace(/\u001b\[[0-9;]*m/g, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const statusLines = text.filter((line) => /^Logged in using /i.test(line));
  if (statusLines.length !== 1 || statusLines[0] !== "Logged in using ChatGPT") {
    throw new Error(`semantic judge requires ChatGPT login; observed ${statusLines.join("; ") || "no authenticated login"}`);
  }
  return {
    authenticated: true,
    method: "chatgpt",
    status: statusLines[0],
    apiKeyForwarded: false,
  };
}

export async function probeChatGptLogin(codex = "codex", processRunner = runProcess) {
  const result = await processRunner(codex, ["login", "status"], {
    env: semanticRuntimeEnvironment(),
    timeoutMs: 15_000,
    captureLimit: 64 * 1024,
  });
  if (result.code !== 0 || result.timedOut || result.spawnError) {
    throw new Error(`Codex login status failed: ${result.spawnError ?? result.stderr.trim() ?? result.code}`);
  }
  return parseChatGptLoginStatus(result.stdout, result.stderr);
}

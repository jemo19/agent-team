import { sha256, stableStringify } from "./common.mjs";
import { codexEnvironment, runProcess } from "./process.mjs";

export async function loadCatalog({ codex = "codex", bundled = false, timeoutMs = 30000 } = {}) {
  const args = ["debug", "models"];
  if (bundled) args.push("--bundled");
  const result = await runProcess(codex, args, {
    env: codexEnvironment(),
    timeoutMs,
    captureLimit: 16 * 1024 * 1024,
  });
  if (result.code !== 0 || result.timedOut || result.spawnError) {
    throw new Error(`codex model catalog failed: ${result.spawnError ?? (result.stderr.trim() || `exit ${result.code}`)}`);
  }
  let parsed;
  try { parsed = JSON.parse(result.stdout); } catch (error) { throw new Error(`codex model catalog is invalid JSON: ${error.message}`); }
  if (!Array.isArray(parsed.models)) throw new Error("codex model catalog has no models array");
  const models = parsed.models.map((model) => ({
    slug: model.slug,
    displayName: model.display_name ?? model.slug,
    supportedInApi: model.supported_in_api === true,
    visibility: model.visibility ?? "unknown",
    defaultReasoningLevel: model.default_reasoning_level ?? null,
    efforts: Array.isArray(model.supported_reasoning_levels) ? model.supported_reasoning_levels.map((entry) => entry.effort) : [],
  }));
  return { source: bundled ? "bundled" : "live", models, digest: sha256(stableStringify(models)), raw: parsed };
}

export function compatibleMatrix(catalog, { models, efforts } = {}) {
  const requestedModels = models ? new Set(models) : null;
  const requestedEfforts = efforts ? new Set(efforts) : null;
  if (requestedModels) {
    const known = new Set(catalog.models.map((model) => model.slug));
    const unknown = [...requestedModels].filter((model) => !known.has(model));
    if (unknown.length) throw new Error(`unknown requested models: ${unknown.join(", ")}`);
  }
  const pairs = [];
  for (const model of catalog.models) {
    if (!model.supportedInApi || model.visibility !== "list") continue;
    if (!model.slug.startsWith("gpt-5.6-")) continue;
    if (requestedModels && !requestedModels.has(model.slug)) continue;
    for (const effort of model.efforts) {
      if (requestedEfforts && !requestedEfforts.has(effort)) continue;
      pairs.push({ model: model.slug, effort });
    }
  }
  if (requestedEfforts) {
    const found = new Set(pairs.map((pair) => pair.effort));
    const unavailable = [...requestedEfforts].filter((effort) => !found.has(effort));
    if (unavailable.length) throw new Error(`requested efforts are unavailable for selected models: ${unavailable.join(", ")}`);
  }
  return pairs;
}

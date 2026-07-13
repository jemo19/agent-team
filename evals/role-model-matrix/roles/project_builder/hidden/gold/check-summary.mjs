function invalidGraph() {
  return Object.assign(new TypeError("Invalid check graph"), { code: "INVALID_CHECK_GRAPH" });
}

export function scheduleChecks(checks) {
  if (!Array.isArray(checks)) throw invalidGraph();
  const graph = new Map();
  for (const check of checks) {
    if (!check || typeof check !== "object" || Array.isArray(check)
      || typeof check.id !== "string" || check.id.length === 0
      || !Array.isArray(check.dependsOn) || check.dependsOn.some((id) => typeof id !== "string" || id.length === 0)
      || new Set(check.dependsOn).size !== check.dependsOn.length || graph.has(check.id)) throw invalidGraph();
    graph.set(check.id, [...check.dependsOn]);
  }
  for (const [id, dependencies] of graph) {
    if (dependencies.includes(id) || dependencies.some((dependency) => !graph.has(dependency))) throw invalidGraph();
  }
  const scheduled = new Set();
  const layers = [];
  while (scheduled.size < graph.size) {
    const ready = [...graph].filter(([id, dependencies]) => !scheduled.has(id) && dependencies.every((dependency) => scheduled.has(dependency)))
      .map(([id]) => id).sort();
    if (!ready.length) throw Object.assign(new Error("Check graph contains a cycle"), { code: "CHECK_GRAPH_CYCLE" });
    layers.push(ready);
    ready.forEach((id) => scheduled.add(id));
  }
  return layers;
}

import rules from "./rules.json";

export function getRoutingThresholds() {
  return rules?.confidenceThresholds || { default: 0.62 };
}

function classifyTask(userInput = "", mode = "architect") {
  const text = String(userInput).toLowerCase();
  const normalizedMode = String(mode).toLowerCase();

  if (normalizedMode === "coding" || /\b(code|debug|function|refactor|typescript|javascript|python)\b/.test(text)) return "coding";
  if (/\b(math|algebra|equation|derivative|integral|probability|statistics)\b/.test(text)) return "math";
  if (normalizedMode === "creative" || /\b(story|poem|creative|narrative|worldbuild)\b/.test(text)) return "creative";
  if (normalizedMode === "system-knowledge" || /\b(omni|system|rules|identity|mode)\b/.test(text)) return "system";

  return "default";
}

export function routeModel({ userInput = "", mode = "architect", complexity = 0 } = {}) {
  const task = classifyTask(userInput, mode);
  let model = rules?.routes?.[task] || rules?.routes?.default || "omni";

  const codingEscalation = Number(rules?.complexityEscalation?.coding ?? 0.7);
  if (task === "coding" && Number(complexity) > codingEscalation) {
    model = "gpt-4o";
  }

  return {
    task,
    model,
    reason: `rule:${task}`
  };
}

export function fallbackModel(currentModel) {
  const order = Array.isArray(rules?.fallbackOrder) ? rules.fallbackOrder : ["omni"];
  const index = order.indexOf(currentModel);
  if (index === -1 || index === order.length - 1) return order[0];
  return order[index + 1];
}

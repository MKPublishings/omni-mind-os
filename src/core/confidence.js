function bounded(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

export function scoreConfidence({ userInput = "", routeTask = "default", retrievalCount = 0, reasoningValid = true, uncertaintySignals = [] } = {}) {
  const text = String(userInput || "").toLowerCase();

  const uncertaintyPattern = /\b(not sure|uncertain|maybe|might|guess|possibly)\b/g;
  const uncertaintyMatches = text.match(uncertaintyPattern)?.length || 0;

  const taskBase = routeTask === "coding"
    ? 0.62
    : routeTask === "math"
      ? 0.58
      : routeTask === "system"
        ? 0.8
        : 0.72;

  const retrievalBoost = Math.min(0.22, Number(retrievalCount || 0) * 0.05);
  const reasoningBoost = reasoningValid ? 0.12 : -0.2;
  const uncertaintyPenalty = uncertaintyMatches * 0.08 + (uncertaintySignals?.length || 0) * 0.05;

  const score = bounded(taskBase + retrievalBoost + reasoningBoost - uncertaintyPenalty);

  return {
    score,
    confidenceBand: score >= 0.8 ? "high" : score >= 0.6 ? "medium" : "low",
    factors: {
      taskBase,
      retrievalBoost,
      reasoningBoost,
      uncertaintyPenalty
    }
  };
}

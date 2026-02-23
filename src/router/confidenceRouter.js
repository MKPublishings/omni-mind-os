// @ts-check

/**
 * @param {{
 *  preferredModel?: string,
 *  task?: string,
 *  confidenceScore?: number,
 *  thresholds?: Record<string, number>
 * }} [options]
 */
export function selectModelByConfidence({ preferredModel = "omni", task = "default", confidenceScore = 0.7, thresholds = {} } = {}) {
  const fallbackThreshold = Number.isFinite(thresholds?.default) ? thresholds.default : 0.62;
  const taskThreshold = Number.isFinite(thresholds?.[task]) ? thresholds[task] : fallbackThreshold;

  if (confidenceScore >= taskThreshold) {
    return {
      model: preferredModel,
      escalated: false,
      threshold: taskThreshold,
      reason: "confidence-sufficient"
    };
  }

  const escalatedModel = task === "math" ? "deepseek" : "gpt-4o";
  return {
    model: escalatedModel,
    escalated: true,
    threshold: taskThreshold,
    reason: "confidence-below-threshold"
  };
}

import { runStabilityPipeline } from "./pipeline.js";

export function runOmniEngine({ userInput = "", mode = "architect", options = {} } = {}) {
  const enhancedReasoning = Boolean(options.enhancedReasoning);
  const stabilityMode = options.stabilityMode !== false;

  const pipelineResult = stabilityMode
    ? runStabilityPipeline({ userInput, mode, enhancedReasoning })
    : { ok: true, stabilized: userInput, reasoning: { verification: { valid: true } }, drift: { drifted: false } };

  if (!pipelineResult.ok) {
    return {
      ok: false,
      fallbackMode: pipelineResult.fallbackMode || "architect",
      output: String(userInput || "")
    };
  }

  return {
    ok: true,
    output: pipelineResult.stabilized,
    reasoning: pipelineResult.reasoning,
    drift: pipelineResult.drift
  };
}

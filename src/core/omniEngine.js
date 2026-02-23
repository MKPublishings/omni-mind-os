// @ts-check
import { runStabilityPipeline } from "./pipeline.js";

/** @typedef {{ enhancedReasoning?: boolean, stabilityMode?: boolean }} OmniEngineOptions */
/** @typedef {{ drifted: boolean, signal?: string | null }} DriftResult */
/** @typedef {{ valid: boolean, issues?: string[] }} VerificationResult */
/** @typedef {{ ok: boolean, finalAnswer: string, verification: VerificationResult }} ReasoningResult */
/** @typedef {{ ok: true, stabilized: string, reasoning: ReasoningResult, drift: DriftResult }} StabilitySuccess */
/** @typedef {{ ok: false, fallbackMode?: string, reasoning: ReasoningResult }} StabilityFailure */
/** @typedef {StabilitySuccess | StabilityFailure} StabilityResult */

/**
 * @param {{ userInput?: string, mode?: string, options?: OmniEngineOptions }} [options]
 */
export function runOmniEngine({ userInput = "", mode = "architect", options = {} } = {}) {
  const enhancedReasoning = Boolean(options.enhancedReasoning);
  const stabilityMode = options.stabilityMode !== false;

  /** @type {StabilityResult} */
  const pipelineResult = stabilityMode
    ? runStabilityPipeline({ userInput, mode, enhancedReasoning })
    : {
      ok: true,
      stabilized: userInput,
      reasoning: { ok: true, finalAnswer: String(userInput || ""), verification: { valid: true } },
      drift: { drifted: false }
    };

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

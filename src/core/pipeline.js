// @ts-check
import { runDualStageReasoning } from "../reasoning/dualStage.js";

/** @typedef {{ drifted: boolean, signal?: string | null }} DriftResult */
/** @typedef {{ valid: boolean, issues?: string[] }} VerificationResult */
/** @typedef {{ ok: boolean, finalAnswer: string, verification: VerificationResult }} ReasoningResult */
/** @typedef {{ ok: true, mode: string, reasoning: ReasoningResult, stabilized: string, drift: DriftResult }} StabilitySuccess */
/** @typedef {{ ok: false, fallbackMode: string, reasoning: ReasoningResult }} StabilityFailure */
/** @typedef {StabilitySuccess | StabilityFailure} StabilityResult */

/**
 * @param {string} text
 * @param {{ maxSections?: number, maxParagraphsPerSection?: number }} [options]
 */
export function enforceSectionLimits(text, { maxSections = 4, maxParagraphsPerSection = 3 } = {}) {
  const raw = String(text || "").trim();
  if (!raw) return "";

  const sections = raw.split(/\n(?=#|\*\*)/g).slice(0, maxSections);
  const normalized = sections.map((section) => {
    const paragraphs = section.split(/\n\n+/).slice(0, maxParagraphsPerSection);
    return paragraphs.join("\n\n");
  });

  return normalized.join("\n\n");
}

/** @param {string} text */
export function detectDrift(text = "") {
  const normalized = String(text || "").toLowerCase();
  const driftSignals = ["as an ai", "i cannot guarantee", "random thought", "off topic"];
  const hit = driftSignals.find((signal) => normalized.includes(signal));
  return {
    drifted: Boolean(hit),
    signal: hit || null
  };
}

/**
 * @param {{ userInput?: string, mode?: string, enhancedReasoning?: boolean }} [options]
 * @returns {StabilityResult}
 */
export function runStabilityPipeline({ userInput = "", mode = "architect", enhancedReasoning = false } = {}) {
  const reasoning = enhancedReasoning
    ? runDualStageReasoning({ userInput })
    : { ok: true, finalAnswer: String(userInput || ""), verification: { valid: true, issues: [] } };

  if (!reasoning.ok) {
    return {
      ok: false,
      fallbackMode: "architect",
      reasoning
    };
  }

  const stabilized = enforceSectionLimits(reasoning.finalAnswer || userInput);
  const drift = detectDrift(stabilized);

  return {
    ok: true,
    mode,
    reasoning,
    stabilized,
    drift
  };
}

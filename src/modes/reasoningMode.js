export const reasoningTemplate = [
  "Reasoning Mode Active.",
  "Think step-by-step internally.",
  "Use this scaffold: Whole -> Parts -> Synthesis.",
  "Output only the final answer."
].join("\n");

export function wrapReasoningPrompt(userInput) {
  const clean = String(userInput || "").trim();
  return `${reasoningTemplate}\n\nUser Input:\n${clean}`;
}

export function reasoningFallback(payload) {
  return {
    fallbackMode: "architect",
    reason: "reasoning_failed_or_low_confidence",
    payload
  };
}

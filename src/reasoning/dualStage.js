import { getTemplate } from "./cotTemplates.js";
import { verifyReasoning } from "./verifier.js";

function stageOneThought(userInput = "", templateName = "wholePartsSynthesis") {
  const template = getTemplate(templateName);
  const cleaned = String(userInput || "").trim();

  return [
    "[Stage 1: Internal Reasoning Draft]",
    template,
    "\nInput:",
    cleaned,
    "\nInternal Notes:",
    "- identify assumptions",
    "- map constraints",
    "- choose strongest path"
  ].join("\n");
}

function stageTwoFinalAnswer(internalDraft = "") {
  const summary = String(internalDraft || "")
    .replace(/^\[Stage 1:[^\n]*\]\n?/i, "")
    .split("\n")
    .slice(0, 8)
    .join("\n");

  return [
    "Final Answer:",
    summary
  ].join("\n");
}

export function runDualStageReasoning({ userInput = "", templateName = "wholePartsSynthesis" } = {}) {
  const internalDraft = stageOneThought(userInput, templateName);
  const verification = verifyReasoning(internalDraft);

  if (!verification.valid) {
    return {
      ok: false,
      fallbackMode: "architect",
      verification,
      internalDraft,
      finalAnswer: ""
    };
  }

  return {
    ok: true,
    verification,
    internalDraft,
    finalAnswer: stageTwoFinalAnswer(internalDraft)
  };
}

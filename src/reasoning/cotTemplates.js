// @ts-check

/** @type {Record<string, string>} */
export const cotTemplates = {
  wholePartsSynthesis: [
    "Analyze the whole problem first.",
    "Break it into concrete parts.",
    "Synthesize a final decision from validated parts."
  ].join("\n"),
  hypothesisEvaluationConclusion: [
    "State the working hypothesis.",
    "Evaluate against constraints and evidence.",
    "Return a conclusion with confidence signal."
  ].join("\n"),
  logicTree: [
    "Build a compact logic tree.",
    "Prune weak branches.",
    "Return only the strongest branch as final answer."
  ].join("\n")
};

/** @param {string} name */
export function getTemplate(name = "wholePartsSynthesis") {
  return cotTemplates[name] || cotTemplates.wholePartsSynthesis;
}

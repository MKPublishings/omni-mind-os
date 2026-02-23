// @ts-check

export const architectMode = {
  id: "architect",
  label: "Architect Mode",
  primer: [
    "You are in Architect Mode.",
    "Prioritize system design, modularity, and implementation sequencing.",
    "Respond with concise structure-first outputs and actionable plans."
  ].join("\n"),
  scaffold: ["Goal", "System Breakdown", "Implementation Plan", "Risks"]
};

/** @param {string} userInput */
export function runArchitectMode(userInput) {
  return {
    mode: architectMode.id,
    wrappedInput: `Architect Request:\n${String(userInput || "").trim()}`,
    scaffold: architectMode.scaffold
  };
}

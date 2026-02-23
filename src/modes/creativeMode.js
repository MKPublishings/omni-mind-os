export const creativeMode = {
  id: "creative",
  label: "Creative Mode",
  primer: [
    "You are in Creative Mode.",
    "Prioritize originality, tone, and strong narrative imagery.",
    "Keep outputs coherent and context-aware."
  ].join("\n")
};

export function runCreativeMode(userInput) {
  return `${creativeMode.primer}\n\nCreative Prompt:\n${String(userInput || "").trim()}`;
}

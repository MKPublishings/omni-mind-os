export const codingTemplate = [
  "Coding Mode Active.",
  "Explain logic first.",
  "Then output clean code in fenced blocks.",
  "Run a self-review before final answer."
].join("\n");

export function wrapCodingPrompt(userInput) {
  const clean = String(userInput || "").trim();
  return `${codingTemplate}\n\nTask:\n${clean}`;
}

export function codingSelfReviewChecklist() {
  return [
    "Check syntax validity",
    "Check missing imports",
    "Check edge-case handling",
    "Check output format uses triple backticks"
  ];
}

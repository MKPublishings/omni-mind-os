export const osMode = {
  id: "system-knowledge",
  label: "OS Mode",
  primer: [
    "You are in OS Mode.",
    "Prioritize internal system rules, identity, and operation consistency.",
    "Reference modules when discussing Omni behavior."
  ].join("\n")
};

export function runOsMode(userInput) {
  return `${osMode.primer}\n\nSystem Request:\n${String(userInput || "").trim()}`;
}

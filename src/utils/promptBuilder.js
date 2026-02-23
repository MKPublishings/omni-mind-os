import { cleanText } from "./textCleaner.js";
import { runArchitectMode } from "../modes/architectMode.js";
import { wrapReasoningPrompt } from "../modes/reasoningMode.js";
import { wrapCodingPrompt } from "../modes/codingMode.js";
import { runCreativeMode } from "../modes/creativeMode.js";
import { runOsMode } from "../modes/osMode.js";

function withContext(header, value) {
  if (!value) return "";
  const body = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return `\n\n[${header}]\n${body}`;
}

export function buildPrompt({ mode = "architect", userInput = "", memory = {}, retrievalChunks = [], moduleText = "" } = {}) {
  const input = cleanText(userInput);
  let base = "";

  switch (String(mode).toLowerCase()) {
    case "reasoning":
      base = wrapReasoningPrompt(input);
      break;
    case "coding":
      base = wrapCodingPrompt(input);
      break;
    case "creative":
      base = runCreativeMode(input);
      break;
    case "system-knowledge":
    case "os":
      base = runOsMode(input);
      break;
    case "architect":
    default: {
      const result = runArchitectMode(input);
      base = result.wrappedInput;
      break;
    }
  }

  const retrievalText = retrievalChunks.length
    ? retrievalChunks.map((chunk, index) => `(${index + 1}) ${chunk.text || chunk}`).join("\n\n")
    : "";

  return [
    base,
    withContext("Memory", memory),
    withContext("Retrieval", retrievalText),
    withContext("Module", moduleText)
  ].join("");
}

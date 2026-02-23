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

function toInfluenceWeight(level = "medium") {
  const normalized = String(level || "medium").toLowerCase();
  if (normalized === "low") return 0.35;
  if (normalized === "high") return 1;
  return 0.7;
}

function buildMemoryBlock(memory = {}, memoryInfluenceLevel = "medium") {
  const weight = toInfluenceWeight(memoryInfluenceLevel);
  if (weight <= 0.4) {
    return {
      memoryInfluenceLevel,
      preferredMode: memory?.preferredMode || "architect",
      tone: memory?.tone || "concise",
      structure: memory?.structure || "sectioned",
      lastTopics: Array.isArray(memory?.lastTopics) ? memory.lastTopics.slice(-2) : []
    };
  }
  return memory;
}

function selectTopRetrieval(retrievalChunks = [], deepKnowledgeMode = false) {
  const maxItems = deepKnowledgeMode ? 3 : 1;
  return retrievalChunks
    .slice()
    .sort((a, b) => Number(b?.score || 0) - Number(a?.score || 0))
    .slice(0, maxItems);
}

export function buildPrompt({
  mode = "architect",
  userInput = "",
  memory = {},
  retrievalChunks = [],
  moduleText = "",
  deepKnowledgeMode = false,
  memoryInfluenceLevel = "medium"
} = {}) {
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

  const selectedRetrieval = selectTopRetrieval(retrievalChunks, deepKnowledgeMode);
  const retrievalText = selectedRetrieval.length
    ? selectedRetrieval
      .map((chunk, index) => {
        const source = chunk?.source ? ` [${chunk.source}]` : "";
        const score = Number.isFinite(chunk?.score) ? ` score=${Number(chunk.score).toFixed(2)}` : "";
        return `(${index + 1})${source}${score}\n${chunk.text || chunk}`;
      })
      .join("\n\n")
    : "";

  const memoryBlock = buildMemoryBlock(memory, memoryInfluenceLevel);

  return [
    base,
    withContext("Memory", memoryBlock),
    withContext("Retrieval", retrievalText),
    withContext("Module", moduleText)
  ].join("");
}

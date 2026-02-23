import fs from "node:fs";
import path from "node:path";
import { buildPrompt } from "../utils/promptBuilder.js";
import { formatResponse } from "../utils/responseFormatter.js";
import { routeModel, fallbackModel } from "../router/modelRouter.js";
import { searchKnowledge } from "../retrieval/ragWorker.js";
import { get as getMemory } from "../memory/memoryManager.js";
import { openaiHandler } from "./openaiHandler.js";
import { deepseekHandler } from "./deepseekHandler.js";

function readModuleFile(name) {
  try {
    const filePath = path.resolve(process.cwd(), `src/modules/${name}`);
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function selectModuleByQuery(userInput = "", mode = "") {
  const text = `${userInput} ${mode}`.toLowerCase();
  if (/\b(identity|who are you|omni)\b/.test(text)) return "identity_layer.md";
  if (/\b(rule|policy|system)\b/.test(text)) return "system_rules.md";
  if (/\b(mode|architect|reasoning|coding|creative)\b/.test(text)) return "modes_reference.md";
  return "omni_philosophy.md";
}

async function runModel({ model, prompt, env }) {
  if (model === "gpt-4o") return openaiHandler({ prompt, model, env });
  if (model === "deepseek") return deepseekHandler({ prompt, model, env });

  return {
    model: "omni",
    text: `[omniHandler:omni] ${String(prompt || "")}`
  };
}

export async function omniHandler({ userInput = "", mode = "architect", env, complexity = 0 } = {}) {
  const memory = getMemory(null, {});
  const retrievalChunks = searchKnowledge(userInput, { topK: 4 });
  const moduleFile = selectModuleByQuery(userInput, mode);
  const moduleText = readModuleFile(moduleFile);

  const prompt = buildPrompt({
    mode,
    userInput,
    memory,
    retrievalChunks,
    moduleText
  });

  const route = routeModel({ userInput, mode, complexity });
  let response = await runModel({ model: route.model, prompt, env });

  if (!response?.text || /not configured/i.test(response.text)) {
    const fallback = fallbackModel(route.model);
    response = await runModel({ model: fallback, prompt, env });
    response.routeFallback = fallback;
  }

  return {
    mode,
    route,
    moduleFile,
    retrievalCount: retrievalChunks.length,
    text: formatResponse(response?.text, { mode }),
    model: response?.model || route.model,
    routeFallback: response?.routeFallback || null
  };
}

// @ts-check
import fs from "node:fs";
import path from "node:path";
import { buildPrompt } from "../utils/promptBuilder.js";
import { formatResponse } from "../utils/responseFormatter.js";
import { routeModel, fallbackModel, getRoutingThresholds } from "../router/modelRouter.js";
import { runTieredRetrieval } from "../retrieval/multiSourceRAG.js";
import { get as getMemory, pushTopic } from "../memory/memoryManager.js";
import { openaiHandler } from "./openaiHandler.js";
import { deepseekHandler } from "./deepseekHandler.js";
import { runOmniEngine } from "../core/omniEngine.js";
import { scoreConfidence } from "../core/confidence.js";
import { selectModelByConfidence } from "../router/confidenceRouter.js";

/** @typedef {import("../types/omni").OmniMode} OmniMode */
/** @typedef {import("../types/omni").OmniResponse} OmniResponse */
/** @typedef {{ model: string, text: string, routeFallback?: string }} ModelResponse */

/** @param {string} name */
function readModuleFile(name) {
  try {
    const filePath = path.resolve(process.cwd(), `src/modules/${name}`);
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

/** @param {string} userInput @param {string} mode */
function selectModuleByQuery(userInput = "", mode = "") {
  const text = `${userInput} ${mode}`.toLowerCase();
  if (/\b(identity|who are you|omni)\b/.test(text)) return "identity_layer.md";
  if (/\b(rule|policy|system)\b/.test(text)) return "system_rules.md";
  if (/\b(mode|architect|reasoning|coding|creative)\b/.test(text)) return "modes_reference.md";
  return "omni_philosophy.md";
}

/**
 * @param {{ model: string, prompt: string, env?: any }} options
 * @returns {Promise<ModelResponse>}
 */
async function runModel({ model, prompt, env }) {
  if (model === "gpt-4o") return openaiHandler({ prompt, model, env });
  if (model === "deepseek") return deepseekHandler({ prompt, model, env });

  return {
    model: "omni",
    text: `[omniHandler:omni] ${String(prompt || "")}`
  };
}

/**
 * @param {{ userInput?: string, mode?: OmniMode, env?: any, complexity?: number }} [options]
 * @returns {Promise<OmniResponse>}
 */
export async function omniHandler({ userInput = "", mode = "architect", env, complexity = 0 } = {}) {
  const memory = /** @type {import("../types/omni").MemoryState} */ (getMemory(null, {}));
  const influenceLevel = memory?.memoryInfluenceLevel || "medium";
  const modeFlags = memory?.lastUsedSettings || {};
  const deepKnowledgeMode = Boolean(modeFlags.deepKnowledgeMode);
  const enhancedReasoning = Boolean(modeFlags.reasoningMode);
  const stabilityMode = modeFlags.stabilityMode !== false;

  const retrievalResult = runTieredRetrieval({
    query: userInput,
    deepKnowledgeMode
  });
  const retrievalChunks = retrievalResult?.selected || [];

  const engine = runOmniEngine({
    userInput,
    mode,
    options: {
      enhancedReasoning,
      stabilityMode
    }
  });

  const processedInput = engine?.ok ? engine.output : userInput;
  const finalMode = engine?.ok ? mode : (engine?.fallbackMode || "architect");

  const moduleFile = selectModuleByQuery(userInput, mode);
  const moduleText = readModuleFile(moduleFile);

  const prompt = buildPrompt({
    mode: /** @type {import("../types/omni").OmniMode} */ (finalMode),
    userInput: processedInput,
    memory,
    retrievalChunks,
    moduleText,
    deepKnowledgeMode,
    memoryInfluenceLevel: influenceLevel
  });

  const route = routeModel({ userInput: processedInput, mode: finalMode, complexity });

  const verification = /** @type {{ issues?: string[] } | undefined} */ (engine?.reasoning?.verification);
  const uncertaintyIssues = Array.isArray(verification?.issues) ? verification.issues : [];

  const confidence = scoreConfidence({
    userInput: processedInput,
    routeTask: route.task,
    retrievalCount: retrievalChunks.length,
    reasoningValid: engine?.reasoning?.verification?.valid !== false,
    uncertaintySignals: uncertaintyIssues
  });

  const confidenceRoute = selectModelByConfidence({
    preferredModel: route.model,
    task: route.task,
    confidenceScore: confidence.score,
    thresholds: getRoutingThresholds()
  });

  let response = await runModel({ model: confidenceRoute.model, prompt, env });

  if (!response?.text || /not configured/i.test(response.text)) {
    const fallback = fallbackModel(confidenceRoute.model);
    response = await runModel({ model: fallback, prompt, env });
    response.routeFallback = fallback;
  }

  pushTopic(userInput);

  return /** @type {OmniResponse} */ ({
    mode: finalMode,
    route: {
      ...route,
      model: confidenceRoute.model,
      reason: confidenceRoute.reason,
      escalated: confidenceRoute.escalated
    },
    moduleFile,
    retrievalCount: retrievalChunks.length,
    text: formatResponse(response?.text, {
      mode: finalMode,
      stabilityMode
    }),
    model: response?.model || confidenceRoute.model,
    routeFallback: response?.routeFallback || null,
    confidence: {
      score: confidence.score,
      band: /** @type {"low" | "medium" | "high"} */ (confidence.confidenceBand),
      threshold: confidenceRoute.threshold,
      escalated: confidenceRoute.escalated
    },
    reasoning: engine?.reasoning || null,
    drift: engine?.drift || { drifted: false },
    sourcePriority: retrievalResult?.sourcePriority || []
  });
}

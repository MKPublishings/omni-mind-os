import type { KVNamespace } from "@cloudflare/workers-types";
import { loadIdentityKernel, evolveIdentityKernel } from "../../../omni/intelligence/identityKernel";
import { runInternalSimulation } from "../../../omni/intelligence/internalSimulation";
import type { OmniReasoningMessage } from "../../../omni/intelligence/reasoningStack";

export interface OmniLoopMessage {
  role: string;
  content: string;
}

export interface OmniLoopContext {
  mode: string;
  model: string;
  messages: OmniLoopMessage[];
  maxOutputTokens?: number;
}

export interface OmniLoopResult {
  response: string;
  modelUsed: string;
  fallbackUsed: boolean;
}

type OmniRuntimeEnv = {
  AI?: { run?: (model: string, input: unknown) => Promise<any> };
  MIND?: KVNamespace;
  MEMORY?: KVNamespace;
  MODEL_OMNI?: string;
  MODEL_GPT_4O?: string;
  MODEL_GPT_4O_MINI?: string;
  MODEL_DEEPSEEK?: string;
  OMNI_SIMULATION_PATHS?: string;
};

function normalizeModelId(model: string): string {
  const value = String(model || "omni").trim().toLowerCase();

  if (value === "gpt4o") return "gpt-4o";
  if (value === "gpt4o-mini" || value === "gpt-4o mini") return "gpt-4o-mini";
  if (value === "deepseek-r1" || value === "deepseek r1") return "deepseek";
  return value;
}

function resolveProviderModel(model: string, env: OmniRuntimeEnv): string {
  const normalized = normalizeModelId(model);
  const omniFallback = env.MODEL_OMNI || "@cf/meta/llama-3.1-8b-instruct";

  switch (normalized) {
    case "omni":
      return omniFallback;

    case "gpt-4o":
      return env.MODEL_GPT_4O || omniFallback;

    case "gpt-4o-mini":
      return env.MODEL_GPT_4O_MINI || omniFallback;

    case "deepseek":
      return env.MODEL_DEEPSEEK || omniFallback;

    default:
      return model || omniFallback;
  }
}

function extractResponseText(raw: any): string {
  return String(
    typeof raw === "string"
      ? raw
      : raw?.response ??
          raw?.result?.response ??
          raw?.output_text ??
          raw?.choices?.[0]?.message?.content ??
          ""
  );
}

function normalizeRole(role: string): OmniReasoningMessage["role"] {
  if (role === "system" || role === "assistant" || role === "user") return role;
  return "user";
}

export async function omniBrainLoop(
  env: OmniRuntimeEnv,
  ctx: OmniLoopContext
): Promise<OmniLoopResult> {
  try {
    if (!env?.AI?.run) {
      return { response: "AI binding is not configured.", modelUsed: "none", fallbackUsed: false };
    }

    const requestedModel = normalizeModelId(ctx.model || "omni");
    const resolvedModel = resolveProviderModel(requestedModel, env);
    const maxOutputTokens =
      Number.isFinite(ctx.maxOutputTokens) && Number(ctx.maxOutputTokens) > 0
        ? Math.floor(Number(ctx.maxOutputTokens))
        : 2048;

    const identity = await loadIdentityKernel(env);
    const safeMessages: OmniReasoningMessage[] = (ctx.messages || [])
      .map((m) => ({
        role: normalizeRole(String(m.role || "")),
        content: String(m.content || "")
      }))
      .filter((m) => m.content.trim().length > 0);

    let modelUsed = resolvedModel;
    let fallbackUsed = false;
    let reasoning;

    try {
      reasoning = await runInternalSimulation({
        env,
        model: resolvedModel,
        identity,
        messages: safeMessages,
        maxOutputTokens
      });
    } catch {
      const fallbackModel = resolveProviderModel("omni", env);
      reasoning = await runInternalSimulation({
        env,
        model: fallbackModel,
        identity,
        messages: safeMessages,
        maxOutputTokens
      });

      modelUsed = fallbackModel;
      fallbackUsed = fallbackModel !== resolvedModel;
    }

    const response = extractResponseText(reasoning.response);

    const latestUserMessage = [...(ctx.messages || [])]
      .reverse()
      .find((message) => String(message?.role || "").toLowerCase() === "user");

    if (latestUserMessage?.content) {
      await evolveIdentityKernel(
        env,
        identity,
        `Recent focus: ${String(latestUserMessage.content).slice(0, 180)}`
      );
    }

    return {
      response: String(response),
      modelUsed,
      fallbackUsed
    };
  } catch {
    return { response: "Runtime loop failed.", modelUsed: "error", fallbackUsed: false };
  }
}
export interface OmniLoopMessage {
  role: string;
  content: string;
}

export interface OmniLoopContext {
  mode: string;
  model: string;
  messages: OmniLoopMessage[];
}

export interface OmniLoopResult {
  response: string;
}

type OmniRuntimeEnv = {
  AI?: { run?: (model: string, input: unknown) => Promise<any> };
  MODEL_OMNI?: string;
  MODEL_GPT_4O?: string;
  MODEL_GPT_4O_MINI?: string;
  MODEL_DEEPSEEK?: string;
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

export async function omniBrainLoop(
  env: OmniRuntimeEnv,
  ctx: OmniLoopContext
): Promise<OmniLoopResult> {
  try {
    if (!env?.AI?.run) {
      return { response: "AI binding is not configured." };
    }

    const requestedModel = normalizeModelId(ctx.model || "omni");
    const resolvedModel = resolveProviderModel(requestedModel, env);

    let raw: any;
    try {
      raw = await env.AI.run(resolvedModel, {
        messages: ctx.messages
      });
    } catch {
      const omniFallback = resolveProviderModel("omni", env);
      raw = await env.AI.run(omniFallback, {
        messages: ctx.messages
      });
    }

    const response = extractResponseText(raw);

    return { response: String(response) };
  } catch {
    return { response: "Runtime loop failed." };
  }
}
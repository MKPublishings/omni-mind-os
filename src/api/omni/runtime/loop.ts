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

export async function omniBrainLoop(
  env: { AI?: { run?: (model: string, input: unknown) => Promise<any> } },
  ctx: OmniLoopContext
): Promise<OmniLoopResult> {
  try {
    if (!env?.AI?.run) {
      return { response: "AI binding is not configured." };
    }

    const requestedModel = String(ctx.model || "omni").trim().toLowerCase();
    const resolvedModel =
      requestedModel === "omni"
        ? "@cf/meta/llama-3.1-8b-instruct"
        : ctx.model;

    const raw = await env.AI.run(resolvedModel, {
      messages: ctx.messages
    });

    const response =
      typeof raw === "string"
        ? raw
        : raw?.response ??
          raw?.result?.response ??
          raw?.output_text ??
          "";

    return { response: String(response) };
  } catch {
    return { response: "Runtime loop failed." };
  }
}
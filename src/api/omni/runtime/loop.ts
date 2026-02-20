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

    const raw = await env.AI.run(ctx.model, {
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
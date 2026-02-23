// This file defines the logic for selecting and routing to different LLM models based on the provided model ID.
import { omniAdapter } from "./omniAdapter";
import { openaiAdapter } from "./openaiAdapter";
import { deepseekAdapter } from "./deepseekAdapter";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };
type ModelAdapter = { generate: (env: any, messages: ChatMessage[]) => Promise<{ text: string }> };

function isValidMessage(m: any): m is ChatMessage {
  return (
    m &&
    (m.role === "system" || m.role === "user" || m.role === "assistant") &&
    typeof m.content === "string" &&
    m.content.trim().length > 0
  );
}

export async function routeModel(body: any, env: any) {
  const model = String(body?.model ?? "omni").toLowerCase();
  const mode = typeof body?.mode === "string" ? body.mode : "Architect";
  const messages = Array.isArray(body?.messages) ? body.messages.filter(isValidMessage) : [];

  if (!messages.length) {
    throw new Error("Invalid message format");
  }

  const adapter = selectModel(model, mode);
  return adapter.generate(env, messages);
}

export function selectModel(modelId: string, mode = "Architect"): ModelAdapter {
  const normalized = String(modelId || "omni").toLowerCase();

  switch (normalized) {
    case "omni":
      return {
        generate: (env, messages) => omniAdapter(messages, mode, env)
      };

    case "gpt-4o":
      return {
        generate: (env, messages) => openaiAdapter(messages, "gpt-4o", env)
      };

    case "gpt-4o-mini":
      return {
        generate: (env, messages) => openaiAdapter(messages, "gpt-4o-mini", env)
      };

    case "deepseek":
      return {
        generate: (env, messages) => deepseekAdapter(messages, env)
      };

    default:
      return {
        generate: (env, messages) => omniAdapter(messages, mode, env)
      };
  }
}
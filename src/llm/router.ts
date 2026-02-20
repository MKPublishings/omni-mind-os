// This file defines the logic for selecting and routing to different LLM models based on the provided model ID.
import { omniAdapter } from "./omniAdapter";
import { openaiAdapter } from "./openaiAdapter";
import { deepseekAdapter } from "./deepseekAdapter";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

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

  switch (model) {
    case "omni":
      return omniAdapter(messages, mode, env);

    case "gpt-4o":
      return openaiAdapter(messages, "gpt-4o", env);

    case "gpt-4o-mini":
      return openaiAdapter(messages, "gpt-4o-mini", env);

    case "deepseek":
      return deepseekAdapter(messages, env);

    default:
      throw new Error("Unknown model: " + model);
  }
}
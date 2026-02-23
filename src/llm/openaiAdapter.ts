export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export async function openaiAdapter(messages: ChatMessage[], model: string, env: any) {
  if (!env?.OPENAI_API_KEY) {
    return { text: "[openaiAdapter] OPENAI_API_KEY is not configured." };
  }

  const latest = messages[messages.length - 1]?.content || "";
  return { text: `[openaiAdapter:${model}] ${String(latest).trim()}` };
}

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export async function deepseekAdapter(messages: ChatMessage[], env: any) {
  if (!env?.DEEPSEEK_API_KEY) {
    return { text: "[deepseekAdapter] DEEPSEEK_API_KEY is not configured." };
  }

  const latest = messages[messages.length - 1]?.content || "";
  return { text: `[deepseekAdapter] ${String(latest).trim()}` };
}

import { optimizedFetch } from "./optimizedStreaming";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export async function deepseekAdapter(messages: ChatMessage[], env: any) {
  if (!env?.DEEPSEEK_API_KEY) {
    return { text: "[deepseekAdapter] DEEPSEEK_API_KEY is not configured." };
  }

  try {
    const cacheKey = `deepseek:${JSON.stringify(messages.slice(-2))}`;
    
    const response = await optimizedFetch(
      "https://api.deepseek.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${env.DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages,
          temperature: 0.7,
          max_tokens: 1000,
          stream: false
        })
      },
      cacheKey,
      1 // High priority
    );

    const text = response.data?.choices?.[0]?.message?.content || "No response from DeepSeek";
    return { text, cached: response.cached, latency: response.latency };
    
  } catch (error: any) {
    return { text: `[deepseekAdapter Error] ${error.message}` };
  }
}

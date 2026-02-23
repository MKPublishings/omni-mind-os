import { optimizedFetch } from "./optimizedStreaming";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export async function openaiAdapter(messages: ChatMessage[], model: string, env: any) {
  if (!env?.OPENAI_API_KEY) {
    return { text: "[openaiAdapter] OPENAI_API_KEY is not configured." };
  }

  try {
    const cacheKey = `openai:${model}:${JSON.stringify(messages.slice(-2))}`;
    
    const response = await optimizedFetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.7,
          max_tokens: 1000,
          stream: false
        })
      },
      cacheKey,
      1 // High priority
    );

    const text = response.data?.choices?.[0]?.message?.content || "No response from OpenAI";
    return { text, cached: response.cached, latency: response.latency };
    
  } catch (error: any) {
    return { text: `[openaiAdapter Error] ${error.message}` };
  }
}

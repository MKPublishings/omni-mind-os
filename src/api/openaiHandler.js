export async function openaiHandler({ prompt, model = "gpt-4o", env } = {}) {
  if (!env?.OPENAI_API_KEY) {
    return {
      model,
      text: "[openaiHandler] OPENAI_API_KEY is not configured."
    };
  }

  return {
    model,
    text: `[openaiHandler:${model}] ${String(prompt || "")}`
  };
}

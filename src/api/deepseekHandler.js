// @ts-check

/**
 * @param {{ prompt?: string, model?: string, env?: any }} [options]
 * @returns {Promise<{ model: string, text: string }>}
 */
export async function deepseekHandler({ prompt, model = "deepseek", env } = {}) {
  if (!env?.DEEPSEEK_API_KEY) {
    return {
      model,
      text: "[deepseekHandler] DEEPSEEK_API_KEY is not configured."
    };
  }

  return {
    model,
    text: `[deepseekHandler:${model}] ${String(prompt || "")}`
  };
}

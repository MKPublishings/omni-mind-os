// @ts-check

const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";

/** @param {any} payload */
function extractDeepSeekText(payload) {
  if (typeof payload === "string") return payload;
  return String(payload?.choices?.[0]?.message?.content || "");
}

/**
 * @param {{ prompt?: string, model?: string, env?: any }} [options]
 * @returns {Promise<{ model: string, text: string }>}
 */
export async function deepseekHandler({ prompt, model = "deepseek", env } = {}) {
  const normalizedPrompt = String(prompt || "").trim();
  if (!normalizedPrompt) {
    return {
      model,
      text: "[deepseekHandler] Prompt is empty."
    };
  }

  if (!env?.DEEPSEEK_API_KEY) {
    return {
      model,
      text: "[deepseekHandler] DEEPSEEK_API_KEY is not configured."
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const mappedModel = model === "deepseek" ? "deepseek-chat" : model;
    const response = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: mappedModel,
        messages: [{ role: "user", content: normalizedPrompt }],
        temperature: 0.6
      }),
      signal: controller.signal
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message = String(payload?.error?.message || `DeepSeek request failed with status ${response.status}`);
      return {
        model,
        text: `[deepseekHandler] ${message}`
      };
    }

    const text = extractDeepSeekText(payload);
    if (!text) {
      return {
        model,
        text: "[deepseekHandler] DeepSeek returned an empty response."
      };
    }

    return {
      model,
      text
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      model,
      text: `[deepseekHandler] ${message}`
    };
  } finally {
    clearTimeout(timeout);
  }
}

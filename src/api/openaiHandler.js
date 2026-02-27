// @ts-check

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

/** @param {any} payload */
function extractOpenAIText(payload) {
  if (typeof payload === "string") return payload;
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part?.text === "string" ? part.text : ""))
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

/**
 * @param {{ prompt?: string, model?: string, env?: any }} [options]
 * @returns {Promise<{ model: string, text: string }>}
 */
export async function openaiHandler({ prompt, model = "gpt-4o", env } = {}) {
  const normalizedPrompt = String(prompt || "").trim();
  if (!normalizedPrompt) {
    return {
      model,
      text: "[openaiHandler] Prompt is empty."
    };
  }

  if (!env?.OPENAI_API_KEY) {
    return {
      model,
      text: "[openaiHandler] OPENAI_API_KEY is not configured."
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: normalizedPrompt }],
        temperature: 0.6
      }),
      signal: controller.signal
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message = String(payload?.error?.message || `OpenAI request failed with status ${response.status}`);
      return {
        model,
        text: `[openaiHandler] ${message}`
      };
    }

    const text = extractOpenAIText(payload);
    if (!text) {
      return {
        model,
        text: "[openaiHandler] OpenAI returned an empty response."
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
      text: `[openaiHandler] ${message}`
    };
  } finally {
    clearTimeout(timeout);
  }
}

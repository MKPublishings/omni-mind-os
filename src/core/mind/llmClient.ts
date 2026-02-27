interface Prompt {
  system: string;
  user: string;
}

type Format = "json" | "text";

interface LLMRequest {
  system: string;
  user: string;
  format: Format;
}

const MODEL_ENDPOINT =
  String(process.env.OMNI_MODEL_ENDPOINT || "").trim() || "http://localhost:3001/llm";

export async function callOmniLLM(prompt: Prompt, format: Format): Promise<unknown> {
  const payload: LLMRequest = {
    system: prompt.system,
    user: prompt.user,
    format
  };

  const response = await fetch(MODEL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LLM call failed: ${response.status} - ${text}`);
  }

  const text = await response.text();
  if (format === "json") {
    try {
      return JSON.parse(text);
    } catch (error) {
      throw new Error(`LLM returned invalid JSON. Raw response:\n${text}\nError: ${String(error)}`);
    }
  }

  return text;
}

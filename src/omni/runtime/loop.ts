import type { OmniMessage } from "../../omni/mindos-core";
import { selectModel } from "../../../llm/router";
import { executeTool } from "../../../tools/execute";
import { OmniSafety } from "../../../stability/safety";

export type OmniBrainContext = {
  mode: string;
  model?: string;
  messages: OmniMessage[];
};

export async function omniBrainLoop(env: any, ctx: OmniBrainContext): Promise<string> {
  // 1. Decide which model to use (explicit model wins, else fall back to mode)
  const modelId = ctx.model || ctx.mode || "omni";
  const model = selectModel(modelId);

  // 2. Sanitize messages before sending to the model
  const safeMessages = ctx.messages.map(m => ({
    role: m.role,
    content: OmniSafety.sanitizeInput(m.content)
  }));

  // 3. Call the model
  const response = await model.generate(env, safeMessages);
  // 4. If the response contains tool calls, execute them and return results
  if (response.text && response.text.includes("[tool]")) {
    const toolResults = await executeTool(env, response.text);
    return `Tool results:\n${toolResults}`;
  }
  
  // 5. Otherwise, return the model's text response
  return response.text;
}
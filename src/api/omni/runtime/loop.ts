import { executeTool } from "../../tools/execute";
import type { OmniMessage } from "../mindos-core";
import { selectModel } from "../../llm/router";
import { OmniSafety } from "../../stability/safety";

export async function omniBrainLoop(env: any, ctx: {
  mode: string;
  messages: OmniMessage[];
}): Promise<string> {

  // ------------------------------------------------------------
  // 1. Select model based on mode
  // ------------------------------------------------------------
  const model = selectModel(ctx.mode);

  // ------------------------------------------------------------
  // 2. Prepare messages (sanitized)
  // ------------------------------------------------------------
  const safeMessages = ctx.messages.map(m => ({
    role: m.role,
    content: OmniSafety.sanitizeInput(m.content)
  }));

  // ------------------------------------------------------------
  // 3. Call the model
  // ------------------------------------------------------------
  const response = await model.generate(env, safeMessages);

  // ------------------------------------------------------------
  // 4. Tool execution (if model requested one)
  // ------------------------------------------------------------
  if (response.tool) {
    const tool = executeTool(response.tool.name);
    if (!tool) {
      return `⚠️ Tool "${response.tool.name}" not found.`;
    }

    const toolResult = await tool.run(response.tool.input);
    return String(toolResult);
  }

  // ------------------------------------------------------------
  // 5. Normal text response
  // ------------------------------------------------------------
  return response.text ?? "";
}
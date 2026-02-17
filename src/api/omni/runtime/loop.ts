import { executeTool } from "../../../tools/execute";
import type { OmniMessage } from "../../mindos-core";
import { selectModel } from "../../../llm/router";
import { OmniSafety } from "../../../stability/safety";

export async function omniBrainLoop(env: any, ctx: {
  mode: string;
  messages: OmniMessage[];
}): Promise<string> {

  const model = selectModel(ctx.mode);

  const safeMessages = ctx.messages.map(m => ({
    role: m.role,
    content: OmniSafety.sanitizeInput(m.content)
  }));

  const response = await model.generate(env, safeMessages);

  if (response.tool) {
    const tool = executeTool(response.tool.name);
    if (!tool) {
      return `⚠️ Tool "${response.tool.name}" not found.`;
    }

    const toolResult = await tool.run(response.tool.input);
    return String(toolResult);
  }

  return response.text ?? "";
}
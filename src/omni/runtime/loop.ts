import { executeTool } from "../../tools/execute";
import { buildOmniPrompt } from "../mindos-core";
import { emotionalCheckpoint } from "../emotion/checkpoint";
import { reflectAndPatch } from "../reflection/patch";
import { selectMode } from "../modes/ai/selector";
import type { OmniContext } from "../mindos-core";

export async function omniBrainLoop(env: any, ctx: OmniContext) {
  // ------------------------------------------------------------
  // 1. Adaptive Mode Selection
  // ------------------------------------------------------------
  const lastUserMessage = ctx.messages[ctx.messages.length - 1]?.content || "";
  ctx.mode = selectMode(lastUserMessage, ctx.mode);

  // ------------------------------------------------------------
  // 2. Build Omni Prompt
  // ------------------------------------------------------------
  const prompt = buildOmniPrompt(ctx);

  // ------------------------------------------------------------
  // 3. Run LLM
  // ------------------------------------------------------------
  let rawOutput = "";
  try {
    const result = await env.AI.run(env.MODEL, {
      prompt,
      max_tokens: 400,
      temperature: 0.7
    });

    rawOutput = result.response || "";
  } catch (err: any) {
    return "Omni encountered an internal reasoning error.";
  }

  // ------------------------------------------------------------
  // 4. Emotional Checkpoint
  // ------------------------------------------------------------
  let stabilized = emotionalCheckpoint(rawOutput);

  // ------------------------------------------------------------
  // 5. Self-Reflection Layer
  // ------------------------------------------------------------
  let refined = reflectAndPatch(stabilized);

  // ------------------------------------------------------------
  // 6. Tool Detection + Execution
  // ------------------------------------------------------------
  const toolMatch = refined.match(/<tool:(.*?)>([\s\S]*?)<\/tool>/);

  if (toolMatch) {
    const toolName = toolMatch[1].trim();
    const toolInput = toolMatch[2].trim();

    const result = await executeTool(toolName, toolInput);

    if (!result.success) {
      return `Tool Error (${toolName}): ${result.error}`;
    }

    return `Tool Result (${
toolName}): ${JSON.stringify(result.output)}`;
  }

    // ------------------------------------------------------------
    // 7. Final Output
    // ------------------------------------------------------------
  return refined.trim();
}

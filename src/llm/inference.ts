// ============================================================
// Omni Ai — LLM Inference Wrapper
// Wraps Cloudflare's AI model with Omni's cognitive engine.
// ============================================================

import { buildOmniPrompt, OmniContext } from "../omni/mindos-core";

export async function runOmniLLM(env: any, ctx: OmniContext) {
  const prompt = buildOmniPrompt(ctx);

  const response = await env.AI.run(env.MODEL, {
    prompt,
    max_tokens: 400,
    temperature: 0.7
  });

  return response;
}
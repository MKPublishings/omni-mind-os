// src/llm/router.ts
import type { OmniBrainContext } from "../api/omni/runtime/loop";
import { omniBrainLoop } from "../api/omni/runtime/loop";

export interface OmniModel {
  generate: (env: any, messages: any[]) => Promise<{ text: string }>;
}

export function selectModel(modelId: string): OmniModel {
  switch (modelId) {
    case "omni":
      return {
        generate: async (env: any, messages: any[]) => {
          const ctx: OmniBrainContext = {
            mode: "Omni",
            model: "omni",
            messages
          };

          const text = await omniBrainLoop(env, ctx);
          return { text };
        }
      };

    case "gpt-4o":
      return {
        generate: async () => {
          return { text: "GPT‑4o placeholder response" };
        }
      };

    case "gpt-4o-mini":
      return {
        generate: async () => {
          return { text: "GPT‑4o Mini placeholder response" };
        }
      };

    case "deepseek":
      return {
        generate: async () => {
          return { text: "DeepSeek placeholder response" };
        }
      };

    default:
      return {
        generate: async () => ({
          text: `Unknown model "${modelId}".`
        })
      };
  }
}
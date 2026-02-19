import { OmniLogger } from "./logging/logger";
import { OmniSafety } from "./stability/safety";
import { OmniKV } from "./memory/kv";
import { omniBrainLoop } from "./api/omni/runtime/loop";

export interface Env {
  AI: any;
  KV: any;
  ASSETS: Fetcher; // correct type
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const logger = new OmniLogger(env);
    const kv = new OmniKV(env);

    try {
      const url = new URL(request.url);

      // -----------------------------
      // /api/omni — main LLM endpoint
      // -----------------------------
      if (url.pathname === "/api/omni" && request.method === "POST") {
        const body = await request.json();

        if (!OmniSafety.validateMessages(body.messages)) {
          logger.error("invalid_messages", body);
          return new Response("Invalid message format", { status: 400 });
        }

        const ctx = {
          mode: body.mode || "Architect",
          model: body.model || "omni",
          messages: body.messages.map((m: any) => ({
            role: m.role,
            content: OmniSafety.sanitizeInput(m.content)
          }))
        };

        logger.log("incoming_request", ctx);

        const response = await omniBrainLoop(env, ctx);

        logger.log("response_generated", { ...ctx, response });

        return new Response(JSON.stringify({ response }), {
          headers: { "Content-Type": "application/json" }
        });
      }

      // -----------------------------
      // Default route → serve website
      // -----------------------------
      return env.ASSETS.fetch(request);

    } catch (err: any) {
      const logger = new OmniLogger(env);
      logger.error("fatal_error", err);
      return new Response("Omni crashed but recovered", { status: 500 });
    }
  }
};
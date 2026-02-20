import { OmniLogger } from "./logging/logger";
import { OmniSafety } from "./stability/safety";
import { omniBrainLoop } from "./api/omni/runtime/loop";
import type { KVNamespace, Fetcher } from "@cloudflare/workers-types";

export interface Env {
  AI: any;
  MEMORY: KVNamespace;
  MIND: KVNamespace;
  ASSETS: Fetcher;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const logger = new OmniLogger(env);

    try {
      const url = new URL(request.url);

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

        const stream = new ReadableStream({
          async start(controller) {
            const result = await omniBrainLoop(env, ctx);

            if (result) {
              const parsedResult =
                typeof result === "string" ? JSON.parse(result) : result;
              const safe = OmniSafety.safeGuardResponse(parsedResult.response);

              for (let i = 0; i < safe.length; i++) {
                controller.enqueue(safe[i]);
                await new Promise((r) => setTimeout(r, 8));
              }
            }

            controller.close();
          }
        });

        return new Response(stream, {
          headers: { "Content-Type": "text/plain; charset=utf-8" }
        });
      }

      // Serve static files from Worker assets
      return env.ASSETS.fetch(request) as unknown as Response;
    } catch (err: any) {
      logger.error("fatal_error", err);
      return new Response("Omni crashed but recovered", { status: 500 });
    }
  }
};
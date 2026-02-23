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

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const logger = new OmniLogger(env);

    try {
      const url = new URL(request.url);

      if (url.pathname === "/api/omni" && request.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: CORS_HEADERS
        });
      }

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

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          async start(controller) {
            try {
              const result = await omniBrainLoop(env, ctx);

              if (result) {
                const parsedResult =
                  typeof result === "string"
                    ? { response: result }
                    : result;
                const safe = OmniSafety.safeGuardResponse(parsedResult.response || "");

                for (let i = 0; i < safe.length; i++) {
                  const token = safe[i];
                  controller.enqueue(encoder.encode(`data: ${token}\n\n`));
                  await new Promise((r) => setTimeout(r, 8));
                }
              }

              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            } catch (streamErr: any) {
              logger.error("stream_error", streamErr);
              controller.enqueue(encoder.encode("data: Runtime loop failed.\n\n"));
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            } finally {
              controller.close();
            }
          }
        });

        return new Response(stream, {
          headers: {
            ...CORS_HEADERS,
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive"
          }
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
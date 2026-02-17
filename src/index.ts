import { OmniModel } from "./llm/router";
import { OmniLogger } from "./logging/logger";
import { OmniSafety } from "./stability/safety";
import { OmniKV } from "./memory/kv";

export interface Env {
  AI: any;
  MEMORY: KVNamespace;
  MIND: KVNamespace;
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

        // STREAMING RESPONSE
        const stream = new ReadableStream({
          async start(controller) {
            const result = await omniRouter(env, ctx);

            if (result?.response) {
              const safe = OmniSafety.safeGuardResponse(result.response);

              for (let i = 0; i < safe.length; i++) {
                controller.enqueue(safe[i]);
                await new Promise(r => setTimeout(r, 8));
              }
            }

            controller.close();
          }
        });

        return new Response(stream, {
          headers: { "Content-Type": "text/plain; charset=utf-8" }
        });
      }

      // -----------------------------
      // /api/kv — simple KV endpoint
      // -----------------------------
      if (url.pathname === "/api/kv" && request.method === "POST") {
        const { key, value } = await request.json();
        await kv.put(key, value);
        return new Response("OK");
      }

      return new Response("Not found", { status: 404 });
    } catch (err) {
      logger.error("request_error", { error: err.message });
      return new Response("Internal Server Error", { status: 500 });
    }
  }
};
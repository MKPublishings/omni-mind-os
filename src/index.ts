import { omniBrainLoop } from "./api/omni/runtime/loop";
import { OmniLogger } from "./logging/logger";
import { OmniSafety } from "./stability/safety";
import type { OmniMessage } from "./api/omni/mindos-core";

export default {
  async fetch(request: Request, env: any): Promise<Response> {
    const logger = new OmniLogger(env);

    try {
      const url = new URL(request.url);

      // ------------------------------------------------------------
      // API: /api/omni  (POST)
      // ------------------------------------------------------------
      if (url.pathname === "/api/omni" && request.method === "POST") {
        const body = await request.json();

        // Validate message structure
        if (!Array.isArray(body.messages)) {
          logger.error("invalid_messages", body);
          return new Response("Invalid message format", { status: 400 });
        }

        // Sanitize + normalize messages
        const messages: OmniMessage[] = body.messages.map((m: any) => ({
          role: m.role,
          content: OmniSafety.sanitizeInput(m.content)
        }));

        const ctx = {
          mode: body.mode || "Architect",
          messages
        };

        logger.log("incoming_request", ctx);

        // ------------------------------------------------------------
        // STREAMING RESPONSE
        // ------------------------------------------------------------
        const stream = new ReadableStream({
          async start(controller) {
            const output = await omniBrainLoop(env, ctx);

            // Stream character-by-character
            for (let i = 0; i < output.length; i++) {
              controller.enqueue(output[i]);
              await new Promise(r => setTimeout(r, 8));
            }

            controller.close();
          }
        });

        return new Response(stream, {
          headers: { "Content-Type": "text/plain; charset=utf-8" }
        });
      }

      // ------------------------------------------------------------
      // Default route
      // ------------------------------------------------------------
      return new Response("Omni Mind/OS Worker Active");
    } catch (err: any) {
      logger.error("fatal_error", err);
      return new Response("Omni crashed but recovered", { status: 500 });
    }
  }
};
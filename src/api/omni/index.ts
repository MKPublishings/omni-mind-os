// src/api/omni/index.ts

import { routeModel } from "../../llm/router";
import { validateMessages } from "../../utils/validation";

export interface OmniRequest {
  messages: { role: string; content: string }[];
  model: string;
  mode: string;
}

export default {
  async fetch(request: Request, env: any): Promise<Response> {
    try {
      if (request.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Allow-Methods": "POST, OPTIONS"
          }
        });
      }

      if (request.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
          status: 405,
          headers: { "Content-Type": "application/json", "Allow": "POST, OPTIONS" }
        });
      }

      // Parse JSON
      const body = (await request.json().catch(() => null)) as OmniRequest | null;
      if (!body) {
        return new Response(JSON.stringify({ error: "Invalid JSON payload" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }

      // Validate structure
      const validationError = validateMessages(body);
      if (validationError) {
        return new Response(JSON.stringify({ error: validationError }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }

      // Route to correct model adapter
      const result = await routeModel(body, env);
      const stream = typeof result === "string" ? result : result?.text || "";

      // Stream back to frontend
      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive"
        }
      });

    } catch (err: any) {
      return new Response(JSON.stringify({ error: "Internal Server Error", detail: String(err?.message || "unknown") }), {
        status: 500
      });
    }
  }
};
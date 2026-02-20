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
      if (request.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
      }

      // Parse JSON
      const body = (await request.json()) as OmniRequest;

      // Validate structure
      const validationError = validateMessages(body);
      if (validationError) {
        return new Response(validationError, { status: 400 });
      }

      // Route to correct model adapter
      const stream = await routeModel(body, env);

      // Stream back to frontend
      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive"
        }
      });

    } catch (err: any) {
      return new Response("Internal Server Error: " + err.message, {
        status: 500
      });
    }
  }
};
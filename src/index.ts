import { OmniLogger } from "./logging/logger";
import { OmniSafety } from "./stability/safety";
import { omniBrainLoop } from "./api/omni/runtime/loop";
import type { KVNamespace, Fetcher } from "@cloudflare/workers-types";

export interface Env {
  AI: any;
  MEMORY: KVNamespace;
  MIND: KVNamespace;
  ASSETS: Fetcher;
  MODEL_OMNI?: string;
  MODEL_GPT_4O?: string;
  MODEL_GPT_4O_MINI?: string;
  MODEL_DEEPSEEK?: string;
  OMNI_RESPONSE_MIN_CHARS?: string;
  OMNI_RESPONSE_BASE_CHARS?: string;
  OMNI_RESPONSE_MAX_CHARS?: string;
  OMNI_ENV?: string;
}

type OmniMessage = {
  role?: string;
  content?: string;
};

function toPositiveInt(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function computeAdaptiveResponseMax(messages: OmniMessage[], env: Env): number {
  const configuredMin = toPositiveInt(env.OMNI_RESPONSE_MIN_CHARS, 2000);
  const configuredBase = toPositiveInt(env.OMNI_RESPONSE_BASE_CHARS, 4500);
  const configuredMax = toPositiveInt(env.OMNI_RESPONSE_MAX_CHARS, 50000);

  const floor = Math.max(500, configuredMin);
  const ceiling = Math.max(floor, configuredMax);
  const base = clamp(configuredBase, floor, ceiling);

  const userMessages = (messages || []).filter((m) => m?.role === "user");
  const latestUserText = String(userMessages[userMessages.length - 1]?.content || "");
  const latestUserChars = latestUserText.trim().length;

  const totalUserChars = userMessages.reduce((sum, m) => {
    return sum + String(m?.content || "").trim().length;
  }, 0);

  const userTurns = userMessages.length;
  const asksForDepth =
    /\b(detailed|detail|thorough|comprehensive|deep(?:\s+dive)?|step[-\s]?by[-\s]?step|full(?:\s+version)?|long(?:er)?|explain)\b/i.test(
      latestUserText
    );

  const effortScore =
    latestUserChars + Math.floor(totalUserChars * 0.35) + userTurns * 140 + (asksForDepth ? 900 : 0);

  const adaptive = base + Math.floor(effortScore * 3.2);
  return clamp(adaptive, floor, ceiling);
}

function isNonProduction(request: Request, env: Env): boolean {
  const explicitEnv = String(env.OMNI_ENV || "").trim().toLowerCase();
  if (explicitEnv) {
    return explicitEnv !== "production";
  }

  const host = new URL(request.url).hostname.toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host.endsWith(".workers.dev");
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

      if (url.pathname === "/api/omni" && request.method !== "POST") {
        return new Response("Method Not Allowed", {
          status: 405,
          headers: {
            ...CORS_HEADERS,
            "Allow": "POST, OPTIONS"
          }
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

        const responseLimit = computeAdaptiveResponseMax(ctx.messages, env);
        const debugEnabled = isNonProduction(request, env);

        logger.log("incoming_request", {
          ...ctx,
          responseCap: responseLimit,
          debugEnabled
        });

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
                const safe = OmniSafety.safeGuardResponse(parsedResult.response || "", responseLimit);

                const chunkSize = 48;
                for (let i = 0; i < safe.length; i += chunkSize) {
                  const token = safe.slice(i, i + chunkSize);
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(token)}\n\n`));
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
            "Connection": "keep-alive",
            ...(debugEnabled
              ? {
                  "X-Omni-Response-Cap": String(responseLimit),
                  "Access-Control-Expose-Headers": "X-Omni-Response-Cap"
                }
              : {})
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
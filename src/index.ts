import { OmniLogger } from "./logging/logger";
import { OmniSafety } from "./stability/safety";
import { omniBrainLoop } from "./api/omni/runtime/loop";
import {
  buildModeTemplate,
  chooseModelForTask,
  getPreferences,
  resetPreferences,
  savePreferences,
  searchKnowledge,
  searchModules,
  shouldUseKnowledgeRetrieval,
  shouldUseSystemKnowledge
} from "./omni/enhancements";
import { warmupConnections, getConnectionStats, TokenStreamOptimizer } from "./llm/cloudflareOptimizations";
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
  OPENAI_API_KEY?: string;
  DEEPSEEK_API_KEY?: string;
  OMNI_RESPONSE_MIN_CHARS?: string;
  OMNI_RESPONSE_BASE_CHARS?: string;
  OMNI_RESPONSE_MAX_CHARS?: string;
  OMNI_MIN_OUTPUT_TOKENS?: string;
  OMNI_MAX_OUTPUT_TOKENS?: string;
  OMNI_ENV?: string;
}

type OmniRole = "system" | "user" | "assistant";

type OmniMessage = {
  role: OmniRole;
  content: string;
};

type OmniRequestBody = {
  mode?: string;
  model?: string;
  messages?: Array<{ role?: string; content?: string }>;
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

function computeAdaptiveOutputTokens(responseCharLimit: number, env: Env): number {
  const configuredMinTokens = toPositiveInt(env.OMNI_MIN_OUTPUT_TOKENS, 512);
  const configuredMaxTokens = toPositiveInt(env.OMNI_MAX_OUTPUT_TOKENS, 8192);

  const minTokens = Math.max(128, configuredMinTokens);
  const maxTokens = Math.max(minTokens, configuredMaxTokens);

  const charsPerToken = 4;
  const targetTokens = Math.ceil(responseCharLimit / charsPerToken);
  return clamp(targetTokens, minTokens, maxTokens);
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
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS"
};

function getLatestUserText(messages: OmniMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === "user") {
      return String(messages[i]?.content || "");
    }
  }

  return "";
}

function makeContextSystemMessage(label: string, content: string): OmniMessage {
  return {
    role: "system",
    content: `[${label}]\n${content}`
  };
}

// Warmup connections on first request (non-blocking)
let connectionsWarmedUp = false;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const logger = new OmniLogger(env);

    // Warmup API connections on first request (non-blocking)
    if (!connectionsWarmedUp) {
      connectionsWarmedUp = true;
      warmupConnections(env).catch(() => {}); // Fire and forget
    }

    try {
      const url = new URL(request.url);
      const isApiRoute = url.pathname === "/api/omni" || url.pathname === "/api/search" || url.pathname === "/api/preferences" || url.pathname === "/api/stats";

      if (isApiRoute && request.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: CORS_HEADERS
        });
      }

      if (url.pathname === "/api/search" && request.method === "GET") {
        const query = String(url.searchParams.get("q") || "").trim();
        const limit = clamp(Number(url.searchParams.get("limit") || 4), 1, 10);

        if (!query) {
          return new Response(JSON.stringify({ query, hits: [] }), {
            headers: {
              ...CORS_HEADERS,
              "Content-Type": "application/json"
            }
          });
        }

        const hits = await searchKnowledge(env, request, query, limit);
        return new Response(JSON.stringify({ query, hits }), {
          headers: {
            ...CORS_HEADERS,
            "Content-Type": "application/json"
          }
        });
      }

      if (url.pathname === "/api/preferences" && request.method === "GET") {
        const memory = await getPreferences(env);
        return new Response(JSON.stringify(memory), {
          headers: {
            ...CORS_HEADERS,
            "Content-Type": "application/json"
          }
        });
      }

      if (url.pathname === "/api/stats" && request.method === "GET") {
        const stats = getConnectionStats();
        return new Response(JSON.stringify(stats), {
          headers: {
            ...CORS_HEADERS,
            "Content-Type": "application/json"
          }
        });
      }

      if (url.pathname === "/api/preferences" && request.method === "POST") {
        const payload = await request.json();
        const memory = await savePreferences(env, payload || {});
        return new Response(JSON.stringify(memory), {
          headers: {
            ...CORS_HEADERS,
            "Content-Type": "application/json"
          }
        });
      }

      if (url.pathname === "/api/preferences" && request.method === "DELETE") {
        await resetPreferences(env);
        return new Response(JSON.stringify({ ok: true }), {
          headers: {
            ...CORS_HEADERS,
            "Content-Type": "application/json"
          }
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
        const body = (await request.json()) as OmniRequestBody;

        if (!body.messages || !OmniSafety.validateMessages(body.messages)) {
          logger.error("invalid_messages", body);
          return new Response("Invalid message format", { status: 400 });
        }

        const normalizedMode = String(body.mode || "auto").trim().toLowerCase();
        const ctx = {
          mode: normalizedMode,
          model: body.model || "auto",
          messages: (body.messages || []).map((m) => ({
            role: (m?.role || "user") as OmniRole,
            content: OmniSafety.sanitizeInput(m?.content || "")
          }))
        };

        const latestUserText = getLatestUserText(ctx.messages);
        const routeSelection = chooseModelForTask(ctx.model, latestUserText, normalizedMode);

        const promptSystemMessages: OmniMessage[] = [];
        const savedMemory = await getPreferences(env);
        if (savedMemory && Object.keys(savedMemory).length > 0) {
          promptSystemMessages.push(
            makeContextSystemMessage("User Memory", JSON.stringify(savedMemory, null, 2))
          );
        }

        const modeTemplate = buildModeTemplate({
          mode: normalizedMode,
          latestUserText
        });

        if (modeTemplate) {
          promptSystemMessages.push(makeContextSystemMessage("Mode Template", modeTemplate));
        }

        const shouldUseKnowledge = shouldUseKnowledgeRetrieval(latestUserText, normalizedMode);
        if (shouldUseKnowledge) {
          const hits = await searchKnowledge(env, request, latestUserText, 4);
          if (hits.length) {
            const context = hits
              .map((hit, index) => `(${index + 1}) ${hit.title}\n${hit.chunk}`)
              .join("\n\n---\n\n");
            promptSystemMessages.push(
              makeContextSystemMessage(
                "Knowledge Retrieval",
                `Use the following retrieved references when they are relevant:\n\n${context}`
              )
            );
          }
        }

        if (shouldUseSystemKnowledge(normalizedMode)) {
          const moduleHits = await searchModules(env, request, latestUserText || "system modules", 3);
          if (moduleHits.length) {
            const moduleContext = moduleHits
              .map((hit, index) => `(${index + 1}) ${hit.title}\n${hit.chunk}`)
              .join("\n\n---\n\n");
            promptSystemMessages.push(
              makeContextSystemMessage(
                "System Knowledge Modules",
                `Use these internal modules as authoritative context:\n\n${moduleContext}`
              )
            );
          }
        }

        const enrichedMessages: OmniMessage[] = [...promptSystemMessages, ...ctx.messages];

        const responseLimit = computeAdaptiveResponseMax(ctx.messages, env);
        const outputTokenLimit = computeAdaptiveOutputTokens(responseLimit, env);
        const debugEnabled = isNonProduction(request, env);

        logger.log("incoming_request", {
          ...ctx,
          modelSelected: routeSelection.selectedModel,
          routeReason: routeSelection.reason,
          taskType: routeSelection.taskType,
          injectedSystemMessages: promptSystemMessages.length,
          responseCap: responseLimit,
          outputTokenCap: outputTokenLimit,
          debugEnabled
        });

        const runtimeCtx = {
          ...ctx,
          model: routeSelection.selectedModel,
          messages: enrichedMessages,
          maxOutputTokens: outputTokenLimit
        };

        const streamOptimizer = new TokenStreamOptimizer({ chunkSize: 48, batchDelay: 5 });

        try {
          const result = await omniBrainLoop(env, runtimeCtx);

          if (result) {
            const parsedResult =
              typeof result === "string"
                ? { response: result }
                : result;
            const safe = OmniSafety.safeGuardResponse(parsedResult.response || "", responseLimit);

            // Use optimized streaming
            const stream = streamOptimizer.createOptimizedStream(safe);

            return new Response(stream, {
              headers: {
                ...CORS_HEADERS,
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Omni-Model-Used": String(runtimeCtx.model || routeSelection.selectedModel),
                "X-Omni-Route-Reason": routeSelection.reason,
                ...(debugEnabled
                  ? {
                      "X-Omni-Response-Cap": String(responseLimit),
                      "X-Omni-Output-Token-Cap": String(outputTokenLimit),
                    "Access-Control-Expose-Headers": "X-Omni-Model-Used, X-Omni-Route-Reason, X-Omni-Response-Cap, X-Omni-Output-Token-Cap"
                    }
                  : {
                      "Access-Control-Expose-Headers": "X-Omni-Model-Used, X-Omni-Route-Reason"
                    })
              }
            });
          }

          // Fallback empty response
          const encoder = new TextEncoder();
          const emptyStream = new ReadableStream({
            start(controller) {
              controller.enqueue(encoder.encode("data: [DONE]\\n\\n"));
              controller.close();
            }
          });

          return new Response(emptyStream, {
            headers: {
              ...CORS_HEADERS,
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              "Connection": "keep-alive"
            }
          });

        } catch (streamErr: any) {
          logger.error("stream_error", streamErr);
          const encoder = new TextEncoder();
          const errorStream = new ReadableStream({
            start(controller) {
              controller.enqueue(encoder.encode("data: Runtime loop failed.\\n\\n"));
              controller.enqueue(encoder.encode("data: [DONE]\\n\\n"));
              controller.close();
            }
          });

          return new Response(errorStream, {
            headers: {
              ...CORS_HEADERS,
              "Content-Type": "text/event-stream",
            "Connection": "keep-alive",
            "X-Omni-Model-Used": String(runtimeCtx.model || routeSelection.selectedModel),
            "X-Omni-Route-Reason": routeSelection.reason,
            ...(debugEnabled
              ? {
                  "X-Omni-Response-Cap": String(responseLimit),
                  "X-Omni-Output-Token-Cap": String(outputTokenLimit),
                "Access-Control-Expose-Headers": "X-Omni-Model-Used, X-Omni-Route-Reason, X-Omni-Response-Cap, X-Omni-Output-Token-Cap"
                }
              : {
                  "Access-Control-Expose-Headers": "X-Omni-Model-Used, X-Omni-Route-Reason"
                })
          }
        });
        }
      }

      // Serve static files from Worker assets
      return env.ASSETS.fetch(request.url) as unknown as Response;
    } catch (err: any) {
      logger.error("fatal_error", err);
      return new Response("Omni crashed but recovered", { status: 500 });
    }
  }
};
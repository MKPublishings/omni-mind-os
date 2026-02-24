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
  MODEL_IMAGE?: string;
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

type ImageRequestBody = {
  prompt?: string;
  userId?: string;
  feedback?: string;
  stylePack?: string;
  quality?: string;
  mode?: string;
  seed?: number;
  debug?: boolean;
};

type ImageModelConfig = {
  model: string;
  styleId: string;
  width: number;
  height: number;
};

type OmniImagePromptData = {
  userPrompt: string;
  tokens: string[];
  semanticExpansion: string;
  technicalTags: string[];
  styleTags: string[];
  negativeTags: string[];
  finalPrompt: string;
  model?: string;
};

type OmniImageOptions = {
  mode?: string;
  stylePack?: string;
  feedback?: string;
  quality?: string;
  seed?: number;
  fresh?: boolean;
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

function sanitizePromptText(prompt: string): string {
  return String(prompt || "")
    .replace(/[\x00-\x1F\x7F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const OMNI_STYLE_PACKS: Record<string, { name: string; tags: string[] }> = {
  mythic_cinematic: {
    name: "Mythic Cinematic",
    tags: ["cinematic lighting", "dramatic contrast", "symbolic composition", "high detail", "emotional depth"]
  },
  anime_realism: {
    name: "Anime Realism",
    tags: ["anime style", "realistic shading", "soft lighting", "vibrant colors"]
  },
  os_cinematic: {
    name: "OS Cinematic",
    tags: ["futuristic UI", "holographic overlays", "clean interface", "glowing panels"]
  },
  noir_tech: {
    name: "Noir Tech",
    tags: ["high contrast", "dark palette", "moody lighting", "cyberpunk atmosphere"]
  }
};

const OMNI_QUALITY_DEFAULT = [
  "8k resolution",
  "ultra detailed",
  "sharp focus",
  "global illumination",
  "subsurface scattering",
  "film grain",
  "depth of field",
  "HDR"
];

const OMNI_NEGATIVE_BASE = [
  "no distortion",
  "no extra limbs",
  "no artifacts",
  "no watermark",
  "no blurry details",
  "no deformed anatomy"
];

const OMNI_NEGATIVE_NO_MOON = ["no moon", "no full moon", "no night sky with moon"];
const OMNI_NEGATIVE_NO_OCEAN = ["no ocean", "no beach", "no water horizon"];

const OMNI_ENVIRONMENTS = [
  "bedroom", "room", "forest", "city", "street", "cafe", "office",
  "studio", "kitchen", "mountains", "desert", "classroom",
  "library", "garage", "basement", "attic", "garden", "cathedral"
];

function tokenizePrompt(text: string): string[] {
  if (!text) return [];
  return String(text)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function inferSceneDescription(prompt: string): string {
  const lower = String(prompt || "").toLowerCase();
  if (lower.includes("bedroom") || lower.includes("room")) {
    return "cozy interior, detailed furniture, realistic lighting";
  }
  if (lower.includes("forest")) {
    return "dense trees, atmospheric fog, grounded natural lighting";
  }
  if (lower.includes("city")) {
    return "urban environment, buildings, street lights, depth and perspective";
  }
  return "coherent environment matching the subject and mood";
}

function getStylePack(name: string): { name: string; tags: string[] } {
  return OMNI_STYLE_PACKS[name] || OMNI_STYLE_PACKS.mythic_cinematic;
}

function applyPromptFreshness(options: OmniImageOptions): OmniImageOptions {
  return {
    ...options,
    seed: Number.isFinite(options.seed) ? Number(options.seed) : Math.floor(Math.random() * 999999999),
    fresh: true
  };
}

function extractEnvironmentKeywords(prompt: string): string[] {
  const lower = String(prompt || "").toLowerCase();
  return OMNI_ENVIRONMENTS.filter((value) => lower.includes(value));
}

function orchestrateOmniImagePrompt(userPrompt: string, options: OmniImageOptions): OmniImagePromptData {
  const tokens = tokenizePrompt(userPrompt);
  const sceneDescription = inferSceneDescription(userPrompt);
  const selectedStylePack = getStylePack(options.stylePack || "mythic_cinematic");

  const semanticExpansion = [userPrompt, sceneDescription].join(", ");
  const styleTags = selectedStylePack.tags || [];
  const technicalTags: string[] = [];

  const finalPrompt = [
    semanticExpansion,
    styleTags.join(", "),
    technicalTags.join(", ")
  ].filter(Boolean).join(", ");

  return {
    userPrompt,
    tokens,
    semanticExpansion,
    technicalTags,
    styleTags,
    negativeTags: [],
    finalPrompt
  };
}

function refineOmniImagePrompt(promptData: OmniImagePromptData, options: OmniImageOptions): { data: OmniImagePromptData; finalOptions: OmniImageOptions } {
  const data: OmniImagePromptData = { ...promptData };

  data.technicalTags = [...(data.technicalTags || []), ...OMNI_QUALITY_DEFAULT];

  const lowerPrompt = data.userPrompt.toLowerCase();
  const negativeTags = [...(data.negativeTags || []), ...OMNI_NEGATIVE_BASE];
  if (!lowerPrompt.includes("moon")) {
    negativeTags.push(...OMNI_NEGATIVE_NO_MOON);
  }
  if (!lowerPrompt.includes("ocean") && !lowerPrompt.includes("sea") && !lowerPrompt.includes("beach")) {
    negativeTags.push(...OMNI_NEGATIVE_NO_OCEAN);
  }
  data.negativeTags = negativeTags;

  const tags = [
    data.semanticExpansion,
    data.styleTags.join(", "),
    data.technicalTags.join(", ")
  ].filter(Boolean).join(", ");

  let finalPrompt = tags;
  if (data.negativeTags.length) {
    finalPrompt += `, negative: ${data.negativeTags.join(", ")}`;
  }

  const envKeywords = extractEnvironmentKeywords(data.userPrompt);
  if (envKeywords.length) {
    finalPrompt = `${finalPrompt}, environment: ${envKeywords.join(", ")}`;
  }

  data.model = "slizzai-imagegen.v2.1";
  data.finalPrompt = finalPrompt;

  return {
    data,
    finalOptions: applyPromptFreshness(options)
  };
}

function parseResolution(value: string): { width: number; height: number } {
  const match = String(value || "").match(/^(\d+)x(\d+)$/i);
  if (!match) return { width: 1024, height: 1024 };
  return {
    width: clamp(Number(match[1]), 256, 1536),
    height: clamp(Number(match[2]), 256, 1536)
  };
}

function selectImageModelConfig(styleId: string, quality: string | undefined, env: Env): ImageModelConfig {
  const resolution = quality === "high" ? "768x768" : quality === "ultra" ? "1024x1024" : "1024x1024";
  const parsed = parseResolution(resolution);
  return {
    model: env.MODEL_IMAGE || "@cf/black-forest-labs/flux-1-schnell",
    styleId: styleId || "mythic_cinematic",
    width: parsed.width,
    height: parsed.height
  };
}

function isReadableByteStream(value: unknown): value is ReadableStream {
  return !!value && typeof (value as any).getReader === "function";
}

function base64ToBytes(base64: string): Uint8Array {
  const normalized = String(base64 || "").replace(/\s+/g, "");
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

async function normalizeImageOutput(raw: unknown): Promise<{ bytes: Uint8Array; mimeType: string }> {
  if (!raw) {
    throw new Error("Empty image response");
  }

  if (raw instanceof ArrayBuffer) {
    return { bytes: new Uint8Array(raw), mimeType: "image/png" };
  }

  if (ArrayBuffer.isView(raw)) {
    return { bytes: new Uint8Array(raw.buffer), mimeType: "image/png" };
  }

  if (isReadableByteStream(raw)) {
    const buffer = await new Response(raw as ReadableStream).arrayBuffer();
    return { bytes: new Uint8Array(buffer), mimeType: "image/png" };
  }

  const candidate =
    (raw as any)?.image ??
    (raw as any)?.result?.image ??
    (raw as any)?.data?.[0]?.b64_json ??
    (raw as any)?.output?.[0]?.image;

  if (typeof candidate === "string") {
    if (candidate.startsWith("data:image/")) {
      const commaIndex = candidate.indexOf(",");
      const header = candidate.slice(5, commaIndex);
      const payload = candidate.slice(commaIndex + 1);
      const mimeType = header.split(";")[0] || "image/png";
      return { bytes: base64ToBytes(payload), mimeType };
    }

    const mimeType =
      (raw as any)?.mimeType ||
      (raw as any)?.contentType ||
      (raw as any)?.content_type ||
      "image/png";

    return { bytes: base64ToBytes(candidate), mimeType };
  }

  throw new Error("Unsupported image response format");
}

function makeImageFilename(styleId: string): string {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const safeStyle = String(styleId || "image").replace(/[^a-zA-Z0-9_-]/g, "_");
  return `slizzai_${safeStyle}_${ts}.png`;
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
      const isApiRoute =
        url.pathname === "/api/omni" ||
        url.pathname === "/api/image" ||
        url.pathname === "/api/search" ||
        url.pathname === "/api/preferences" ||
        url.pathname === "/api/stats";

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

      if (url.pathname === "/api/image" && request.method !== "POST") {
        return new Response("Method Not Allowed", {
          status: 405,
          headers: {
            ...CORS_HEADERS,
            "Allow": "POST, OPTIONS"
          }
        });
      }

      if (url.pathname === "/api/image" && request.method === "POST") {
        try {
          const body = (await request.json()) as ImageRequestBody;
          const userId = sanitizePromptText(String(body?.userId || "anonymous"));
          const promptText = sanitizePromptText(String(body?.prompt || ""));
          const feedback = sanitizePromptText(String(body?.feedback || ""));
          const requestedStylePack = sanitizePromptText(String(body?.stylePack || "mythic_cinematic")).toLowerCase() || "mythic_cinematic";
          const requestedQuality = sanitizePromptText(String(body?.quality || "ultra")).toLowerCase() || "ultra";
          const requestedMode = sanitizePromptText(String(body?.mode || "simple")).toLowerCase() || "simple";
          const parsedSeed = Number(body?.seed);
          const debugRequested =
            body?.debug === true ||
            String(url.searchParams.get("debug") || "").toLowerCase() === "true";

          if (!promptText) {
            return new Response(JSON.stringify({ error: "Prompt is required" }), {
              status: 400,
              headers: {
                ...CORS_HEADERS,
                "Content-Type": "application/json"
              }
            });
          }

          const orchestrated = orchestrateOmniImagePrompt(promptText, {
            mode: requestedMode,
            stylePack: requestedStylePack,
            quality: requestedQuality,
            feedback,
            seed: Number.isFinite(parsedSeed) ? parsedSeed : undefined
          });

          const refined = refineOmniImagePrompt(orchestrated, {
            mode: requestedMode,
            stylePack: requestedStylePack,
            quality: requestedQuality,
            feedback,
            seed: Number.isFinite(parsedSeed) ? parsedSeed : undefined
          });

          const modelConfig = selectImageModelConfig(requestedStylePack, requestedQuality, env);

          const rawImage = await env.AI.run(modelConfig.model, {
            prompt: refined.data.finalPrompt,
            width: modelConfig.width,
            height: modelConfig.height,
            seed: refined.finalOptions.seed
          });

          const normalized = await normalizeImageOutput(rawImage);
          const imageDataUrl = `data:${normalized.mimeType};base64,${bytesToBase64(normalized.bytes)}`;
          const filename = makeImageFilename(modelConfig.styleId);

          const responsePayload: Record<string, unknown> = {
            user_id: userId,
            imageDataUrl,
            filename,
            metadata: {
              style_id: modelConfig.styleId,
              model: modelConfig.model,
              resolution: `${modelConfig.width}x${modelConfig.height}`,
              mode: requestedMode,
              quality: requestedQuality,
              seed: refined.finalOptions.seed,
              feedbackApplied: Boolean(feedback),
              prompt: {
                userPrompt: orchestrated.userPrompt,
                semanticExpansion: orchestrated.semanticExpansion,
                technicalTags: refined.data.technicalTags,
                styleTags: refined.data.styleTags,
                negativeTags: refined.data.negativeTags,
                finalPrompt: refined.data.finalPrompt
              },
              export_location: "chat-download"
            }
          };

          if (debugRequested) {
            responsePayload.debug = {
              requested: {
                mode: requestedMode,
                stylePack: requestedStylePack,
                quality: requestedQuality,
                seed: Number.isFinite(parsedSeed) ? parsedSeed : null
              },
              pass1_orchestrated: {
                userPrompt: orchestrated.userPrompt,
                tokens: orchestrated.tokens,
                semanticExpansion: orchestrated.semanticExpansion,
                styleTags: orchestrated.styleTags
              },
              pass2_technicalEnhancement: {
                technicalTags: refined.data.technicalTags
              },
              pass3_negativePrompting: {
                negativeTags: refined.data.negativeTags
              },
              pass4_sceneEnforcer: {
                environmentKeywords: extractEnvironmentKeywords(orchestrated.userPrompt)
              },
              pass5_modelAdapter: {
                targetModel: refined.data.model,
                finalPrompt: refined.data.finalPrompt
              }
            };
          }

          return new Response(
            JSON.stringify(responsePayload),
            {
              headers: {
                ...CORS_HEADERS,
                "Content-Type": "application/json",
                "X-Omni-Image-Model": modelConfig.model,
                "Access-Control-Expose-Headers": "X-Omni-Image-Model"
              }
            }
          );
        } catch (imageErr: any) {
          logger.error("image_generation_error", imageErr);
          return new Response(JSON.stringify({ error: "Image generation failed" }), {
            status: 500,
            headers: {
              ...CORS_HEADERS,
              "Content-Type": "application/json"
            }
          });
        }
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
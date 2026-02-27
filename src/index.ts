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
import { assemblePrompt } from "./omni/rendering/engine/promptAssembler";
import { listAvailableStyles, resolveStyleName } from "./omni/rendering/styles/styleRegistry";
import { buildLawPromptDirectives, applyLawsToVisualInfluence, type LawReference } from "./omni/laws/imageLawBridge";
import { Laws, type LawDomain } from "./omni/laws/lawRegistry";
import { warmupConnections, getConnectionStats } from "./llm/cloudflareOptimizations";
import { advanceSimulationState } from "./omni/simulation/engine";
import { ensureOmniMemorySchema, getRecentMemoryArc, saveMemoryTurn } from "./memory/d1Memory";
import { formatWorkingMemoryPrompt, loadWorkingMemory, updateWorkingMemoryFromTurn } from "./memory/workingMemory";
import { runSelfMaintenance } from "./maintenance/selfMaintenance";
import { getMaintenanceStatus } from "./maintenance/status";
import { decideMultimodalRoute } from "./omni/multimodal/router";
import { runVisualReasoning } from "./omni/multimodal/visualReasoner";
import { buildPersonaPrompt, resolvePersonaProfile } from "./omni/behavior/personaEngine";
import { buildEmotionalResonancePrompt, getEmotionalResonance, persistEmotionalResonance } from "./omni/behavior/emotionalResonance";
import { applyAdaptiveBehavior, buildAdaptiveBehaviorPrompt } from "./omni/behavior/adaptiveBehavior";
import { executeTool } from "./tools/execute";
import {
  BudgetAwareEstimatorEncoder,
  LinearHoldFrameInterpolator,
  OmniVideoEnginePhase1Impl,
  type GenerateVideoClipPhase1Request,
  type StyleRegistry,
  type VideoFormat,
  type VideoQualityMode
} from "./omni/video/phase1";
import type { KVNamespace, Fetcher, DurableObjectNamespace, D1Database, ScheduledController, ExecutionContext } from "@cloudflare/workers-types";

export { OmniSession } from "./memory/session";

export interface Env {
  AI: any;
  MEMORY: KVNamespace;
  MIND: KVNamespace;
  ASSETS: Fetcher;
  OMNI_DB?: D1Database;
  OMNI_SESSION?: DurableObjectNamespace;
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
  OMNI_MEMORY_RETENTION_DAYS?: string;
  OMNI_SESSION_MAX_AGE_HOURS?: string;
  OMNI_AUTONOMY_LEVEL?: string;
  OMNI_ADMIN_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
  TURNSTILE_SITE_KEY?: string;
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
  safetyProfile?: {
    ageTier?: string;
    humanVerified?: boolean;
    nsfwAccess?: boolean;
    explicitAllowed?: boolean;
    illegalBlocked?: boolean;
  };
};

type HumanVerifyRequestBody = {
  token?: string;
  challengeId?: string;
  challengeAnswer?: string;
  birthDate?: {
    year?: number;
    month?: number;
    day?: number;
  };
};

type VideoPhase1RequestBody = GenerateVideoClipPhase1Request & {
  safetyProfile?: {
    ageTier?: string;
    humanVerified?: boolean;
    nsfwAccess?: boolean;
    explicitAllowed?: boolean;
    illegalBlocked?: boolean;
  };
};

type VideoGenerateRequestBody = VideoPhase1RequestBody & {
  durationSeconds?: number;
  width?: number;
  height?: number;
  fps?: number;
};

type OmniVideoJobStatus = "queued" | "running" | "succeeded" | "failed";

type OmniVideoJob = {
  id: string;
  status: OmniVideoJobStatus;
  prompt: string;
  durationSeconds: number;
  width: number;
  height: number;
  fps: number;
  createdAt: string;
  mp4Url?: string;
  gifUrl?: string;
  thumbnailUrl?: string;
  keyframePreviewUrls?: string[];
  errorMessage?: string;
};

type ImageRequestBody = {
  prompt?: string;
  userId?: string;
  feedback?: string;
  stylePack?: string;
  laws?: LawReference[];
  quality?: string;
  mode?: string;
  seed?: number;
  debug?: boolean;
  ratio?: string;
  resolution?: string;
  width?: number;
  height?: number;
  camera?: string;
  lighting?: string;
  materials?: string[];
  safetyProfile?: {
    ageTier?: string;
    humanVerified?: boolean;
    nsfwAccess?: boolean;
    explicitAllowed?: boolean;
    illegalBlocked?: boolean;
  };
};

type SafetyProfile = {
  ageTier: "adult" | "minor";
  humanVerified: boolean;
  nsfwAccess: boolean;
  explicitAllowed: boolean;
  illegalBlocked: boolean;
};

type InternetSearchHit = {
  title: string;
  snippet: string;
  url: string;
  source: "duckduckgo" | "wikipedia";
};

type InternetWeatherResult = {
  location: string;
  latitude: number;
  longitude: number;
  temperatureC: number;
  windSpeedKmh: number;
  weatherCode: number;
  observationTime: string;
  timezone: string;
};

type InternetInspectResult = {
  url: string;
  title: string;
  excerpt: string;
  contentPreview: string;
};

type InternetLearningFact = {
  title: string;
  snippet: string;
  url: string;
  source: "duckduckgo" | "wikipedia";
};

type InternetLearningEntry = {
  id: string;
  ts: number;
  mode: string;
  query: string;
  facts: InternetLearningFact[];
};

type InternetLearningStore = {
  updatedAt: number;
  entries: InternetLearningEntry[];
};

const INTERNET_LEARNING_KEY = "omni_internet_learning_v1";
const INTERNET_LEARNING_MAX_ENTRIES = 120;
const VIDEO_JOB_KEY_PREFIX = "video:job:";
const VIDEO_JOB_TTL_SEC = 6 * 60 * 60;

const VIDEO_STYLE_REGISTRY: StyleRegistry = {
  styles: {
    style_omni_anime_realism_v1: {
      id: "style_omni_anime_realism_v1",
      name: "omni_anime_realism",
      description: "omni anime realism cinematic character style",
      embedding: []
    },
    style_omni_cinematic_soft_light_v1: {
      id: "style_omni_cinematic_soft_light_v1",
      name: "omni_cinematic_soft_light",
      description: "soft cinematic lighting and filmic contrast",
      embedding: []
    },
    style_omni_high_contrast_neon_v1: {
      id: "style_omni_high_contrast_neon_v1",
      name: "omni_high_contrast_neon",
      description: "high contrast neon night city palette",
      embedding: []
    }
  },
  identities: {},
  contexts: {
    ctx_neon_city_rain: {
      id: "ctx_neon_city_rain",
      description: "neon city rooftop in rain",
      embedding: []
    },
    ctx_daylight_clear: {
      id: "ctx_daylight_clear",
      description: "daytime clear weather exterior",
      embedding: []
    }
  }
};

type InternetSearchProfile = {
  queryPrefix: string;
  querySuffix: string;
  limit: number;
};

type ImageModelConfig = {
  model: string;
  styleId: string;
  width: number;
  height: number;
  ratio: string;
  resolution: string;
};

type OmniImagePromptData = {
  userPrompt: string;
  tokens: string[];
  semanticExpansion: string;
  lawTags: string[];
  lawInfluence: {
    ids: string[];
    palette: string[];
    geometry: string[];
    motion: string[];
    symbols: string[];
  };
  technicalTags: string[];
  styleTags: string[];
  negativeTags: string[];
  finalPrompt: string;
  model?: string;
};

type TimeIntent = "day" | "night" | "sunset" | "indoor" | "neutral";

type OmniImageOptions = {
  mode?: string;
  stylePack?: string;
  laws?: LawReference[];
  feedback?: string;
  quality?: string;
  seed?: number;
  fresh?: boolean;
  camera?: string;
  lighting?: string;
  materials?: string[];
};

type OmniImageGenerationResult = {
  imageDataUrl: string;
  filename: string;
  metadata: Record<string, unknown>;
  model: string;
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

function computeAgeFromBirthDate(year: number, month: number, day: number, now = new Date()): number {
  const dob = new Date(Date.UTC(year, month - 1, day));
  if (
    Number.isNaN(dob.getTime()) ||
    dob.getUTCFullYear() !== year ||
    dob.getUTCMonth() !== month - 1 ||
    dob.getUTCDate() !== day
  ) {
    return -1;
  }

  const nowUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (dob.getTime() > nowUtc.getTime()) return -1;

  let age = nowUtc.getUTCFullYear() - dob.getUTCFullYear();
  const monthDiff = nowUtc.getUTCMonth() - dob.getUTCMonth();
  const dayDiff = nowUtc.getUTCDate() - dob.getUTCDate();
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age -= 1;
  }

  return age;
}

function getRequestIp(request: Request): string {
  return String(request.headers.get("cf-connecting-ip") || "").trim();
}

async function verifyTurnstileToken(request: Request, env: Env, token: string): Promise<boolean> {
  const secret = String(env.TURNSTILE_SECRET_KEY || "").trim();
  if (!secret) {
    return isNonProduction(request, env);
  }

  const payload = new URLSearchParams();
  payload.set("secret", secret);
  payload.set("response", token);
  const remoteIp = getRequestIp(request);
  if (remoteIp) {
    payload.set("remoteip", remoteIp);
  }

  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: payload.toString()
    });

    if (!response.ok) return false;
    const result = (await response.json()) as { success?: boolean };
    return result?.success === true;
  } catch {
    return false;
  }
}

type HumanChallengeRecord = {
  answer: string;
  createdAt: number;
};

function makeHumanChallengePrompt(): { prompt: string; answer: string } {
  const a = Math.floor(Math.random() * 16) + 5;
  const b = Math.floor(Math.random() * 16) + 3;
  const useAddition = Math.random() >= 0.35;

  if (useAddition) {
    return {
      prompt: `What is ${a} + ${b}?`,
      answer: String(a + b)
    };
  }

  const high = Math.max(a, b);
  const low = Math.min(a, b);
  return {
    prompt: `What is ${high} - ${low}?`,
    answer: String(high - low)
  };
}

async function createHumanChallenge(env: Env): Promise<{ challengeId: string; prompt: string; expiresInSec: number }> {
  const challengeId = crypto.randomUUID();
  const challenge = makeHumanChallengePrompt();
  const record: HumanChallengeRecord = {
    answer: challenge.answer,
    createdAt: Date.now()
  };

  if (env.MEMORY) {
    await env.MEMORY.put(`human_challenge:${challengeId}`, JSON.stringify(record), {
      expirationTtl: 5 * 60
    });
  }

  return {
    challengeId,
    prompt: challenge.prompt,
    expiresInSec: 5 * 60
  };
}

async function verifyFallbackChallenge(env: Env, challengeId: string, answer: string): Promise<boolean> {
  if (!env.MEMORY) return false;
  const key = `human_challenge:${challengeId}`;
  const raw = await env.MEMORY.get(key);
  if (!raw) return false;

  await env.MEMORY.delete(key);

  try {
    const parsed = JSON.parse(raw) as HumanChallengeRecord;
    const expected = String(parsed?.answer || "").trim();
    const provided = String(answer || "").trim();
    if (!expected || !provided) return false;
    return expected === provided;
  } catch {
    return false;
  }
}

function getLatestUserText(messages: OmniMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === "user") {
      return String(messages[i]?.content || "");
    }
  }

  return "";
}

function normalizeSafetyProfile(raw: OmniRequestBody["safetyProfile"] | ImageRequestBody["safetyProfile"]): SafetyProfile {
  const tier = String(raw?.ageTier || "minor").trim().toLowerCase() === "adult" ? "adult" : "minor";
  const humanVerified = Boolean(raw?.humanVerified);
  const nsfwAccess = Boolean(raw?.nsfwAccess) && tier === "adult";

  return {
    ageTier: tier,
    humanVerified,
    nsfwAccess,
    explicitAllowed: Boolean(raw?.explicitAllowed) && nsfwAccess,
    illegalBlocked: raw?.illegalBlocked !== false
  };
}

function evaluateSexualSafetyPrompt(text: string, safetyProfile: SafetyProfile): { blocked: boolean; reason: string } {
  const input = String(text || "").toLowerCase();

  const directIllegalPattern = /\b(bestiality|child\s*porn|csam|rape\s*content|exploitative\s*sexual|incest\s*porn)\b/i;
  const illegalMinorSexualPattern = /\b(child|minor|underage|teen)\b[\s\S]{0,35}\b(sex|sexual|nude|nudity|porn|erotic|fetish)\b/i;
  const illegalAssaultPattern = /\b(sexual\s*assault|forced\s*sex|non[-\s]?consensual\s*sex)\b/i;

  if (directIllegalPattern.test(input) || illegalMinorSexualPattern.test(input) || illegalAssaultPattern.test(input)) {
    return { blocked: true, reason: "illegal-content-blocked" };
  }

  return { blocked: false, reason: "allowed" };
}

function normalizeImageGenerationError(err: any): {
  status: number;
  code: string;
  message: string;
  details?: string;
} {
  const rawMessage = String(err?.message || err?.error || "").trim();
  const value = rawMessage.toLowerCase();

  if (
    value.includes("moderat") ||
    value.includes("safety") ||
    value.includes("policy") ||
    value.includes("unsafe") ||
    value.includes("content blocked")
  ) {
    return {
      status: 422,
      code: "provider-policy-blocked",
      message: "Image provider rejected this prompt under policy constraints.",
      details: rawMessage || undefined
    };
  }

  if (
    value.includes("too long") ||
    value.includes("context length") ||
    value.includes("max tokens") ||
    value.includes("input is too large")
  ) {
    return {
      status: 400,
      code: "prompt-too-long",
      message: "Prompt is too long for the image provider. Shorten the prompt and retry.",
      details: rawMessage || undefined
    };
  }

  if (value.includes("timeout") || value.includes("timed out") || value.includes("deadline")) {
    return {
      status: 504,
      code: "provider-timeout",
      message: "Image generation timed out. Please retry.",
      details: rawMessage || undefined
    };
  }

  if (value.includes("unavailable") || value.includes("overloaded") || value.includes("rate limit")) {
    return {
      status: 503,
      code: "provider-unavailable",
      message: "Image provider is temporarily unavailable. Retry shortly.",
      details: rawMessage || undefined
    };
  }

  return {
    status: 500,
    code: "image-generation-failed",
    message: "Image generation failed.",
    details: rawMessage || undefined
  };
}

const INTERNET_MODE_PROFILES: Record<string, InternetSearchProfile> = {
  auto: { queryPrefix: "overview", querySuffix: "latest", limit: 4 },
  architect: { queryPrefix: "architecture patterns", querySuffix: "design tradeoffs", limit: 5 },
  analyst: { queryPrefix: "analysis", querySuffix: "evidence", limit: 5 },
  visual: { queryPrefix: "visual design", querySuffix: "examples", limit: 4 },
  lore: { queryPrefix: "history", querySuffix: "timeline", limit: 4 },
  reasoning: { queryPrefix: "explain", querySuffix: "why", limit: 4 },
  coding: { queryPrefix: "developer docs", querySuffix: "implementation", limit: 5 },
  knowledge: { queryPrefix: "reference", querySuffix: "facts", limit: 5 },
  "system-knowledge": { queryPrefix: "systems engineering", querySuffix: "best practices", limit: 5 },
  simulation: { queryPrefix: "simulation methods", querySuffix: "models", limit: 3 }
};

function normalizeInternetMode(mode: string): keyof typeof INTERNET_MODE_PROFILES {
  const normalized = String(mode || "auto").trim().toLowerCase();
  if (Object.prototype.hasOwnProperty.call(INTERNET_MODE_PROFILES, normalized)) {
    return normalized as keyof typeof INTERNET_MODE_PROFILES;
  }
  return "auto";
}

function buildInternetQueries(mode: string, userText: string): string[] {
  const key = normalizeInternetMode(mode);
  const profile = INTERNET_MODE_PROFILES[key];
  const base = sanitizePromptText(String(userText || "")).trim();
  if (!base) return [];

  const primary = `${profile.queryPrefix} ${base} ${profile.querySuffix}`.replace(/\s+/g, " ").trim();
  const fallback = `${base} ${profile.querySuffix}`.replace(/\s+/g, " ").trim();
  return [...new Set([primary, fallback].filter(Boolean))];
}

function flattenDuckDuckGoTopics(items: any[], collector: InternetSearchHit[]): void {
  for (const item of items || []) {
    if (item?.Topics && Array.isArray(item.Topics)) {
      flattenDuckDuckGoTopics(item.Topics, collector);
      continue;
    }

    const title = sanitizePromptText(String(item?.Text || "")).trim();
    const url = sanitizePromptText(String(item?.FirstURL || "")).trim();
    if (!title || !url) continue;

    collector.push({
      title: title.slice(0, 160),
      snippet: title.slice(0, 320),
      url,
      source: "duckduckgo"
    });
  }
}

async function searchDuckDuckGo(query: string, limit = 4): Promise<InternetSearchHit[]> {
  const target = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&no_redirect=1`;
  const response = await fetch(target, { method: "GET" });
  if (!response.ok) return [];

  const data = (await response.json()) as any;
  const hits: InternetSearchHit[] = [];

  const abstract = sanitizePromptText(String(data?.AbstractText || "")).trim();
  const abstractUrl = sanitizePromptText(String(data?.AbstractURL || "")).trim();
  const heading = sanitizePromptText(String(data?.Heading || "")).trim();
  if (abstract && abstractUrl) {
    hits.push({
      title: heading || "DuckDuckGo Result",
      snippet: abstract.slice(0, 400),
      url: abstractUrl,
      source: "duckduckgo"
    });
  }

  flattenDuckDuckGoTopics(Array.isArray(data?.RelatedTopics) ? data.RelatedTopics : [], hits);
  return hits.slice(0, Math.max(1, limit));
}

async function searchWikipedia(query: string, limit = 4): Promise<InternetSearchHit[]> {
  const target = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=${Math.max(1, limit)}&namespace=0&format=json`;
  const response = await fetch(target, { method: "GET" });
  if (!response.ok) return [];

  const data = (await response.json()) as [string, string[], string[], string[]] | unknown;
  if (!Array.isArray(data) || data.length < 4) return [];

  const titles = Array.isArray(data[1]) ? data[1] : [];
  const descriptions = Array.isArray(data[2]) ? data[2] : [];
  const urls = Array.isArray(data[3]) ? data[3] : [];
  const hits: InternetSearchHit[] = [];

  for (let i = 0; i < titles.length; i += 1) {
    const title = sanitizePromptText(String(titles[i] || "")).trim();
    const snippet = sanitizePromptText(String(descriptions[i] || "")).trim();
    const url = sanitizePromptText(String(urls[i] || "")).trim();
    if (!title || !url) continue;

    hits.push({
      title: title.slice(0, 160),
      snippet: snippet.slice(0, 400),
      url,
      source: "wikipedia"
    });
  }

  return hits.slice(0, Math.max(1, limit));
}

function dedupeInternetHits(hits: InternetSearchHit[], limit: number): InternetSearchHit[] {
  const out: InternetSearchHit[] = [];
  const seen = new Set<string>();
  for (const hit of hits) {
    const key = `${hit.url}|${hit.title}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(hit);
    if (out.length >= limit) break;
  }
  return out;
}

async function performModeAwareInternetSearch(mode: string, userText: string): Promise<{ profile: InternetSearchProfile; hits: InternetSearchHit[] }> {
  const key = normalizeInternetMode(mode);
  const profile = INTERNET_MODE_PROFILES[key];
  const queries = buildInternetQueries(key, userText);
  if (!queries.length) {
    return { profile, hits: [] };
  }

  const collected: InternetSearchHit[] = [];
  for (const query of queries.slice(0, 2)) {
    const [ddg, wiki] = await Promise.all([
      searchDuckDuckGo(query, profile.limit),
      searchWikipedia(query, profile.limit)
    ]);
    collected.push(...ddg, ...wiki);
    if (collected.length >= profile.limit * 2) break;
  }

  return {
    profile,
    hits: dedupeInternetHits(collected, profile.limit)
  };
}

function shouldUseInternetSearch(userText: string, mode: string): boolean {
  const value = String(userText || "").trim();
  if (!value) return false;
  if (normalizeInternetMode(mode) === "simulation") return false;
  const intentPattern = /\b(latest|current|today|news|recent|what is|how to|documentation|docs|guide|compare|vs\.?|benchmark|release|update)\b/i;
  return intentPattern.test(value) || value.length > 24;
}

function shouldUseWeatherContext(userText: string): boolean {
  const value = String(userText || "").trim().toLowerCase();
  if (!value) return false;
  return /\b(weather|temperature|forecast|rain|snow|humidity|wind|climate)\b/i.test(value);
}

function inferWeatherLocation(userText: string, request: Request): string {
  const value = String(userText || "").trim();
  const match = value.match(/\b(?:in|for|at)\s+([a-zA-Z][a-zA-Z\s\-]{1,64})\??$/i);
  if (match && match[1]) {
    return sanitizePromptText(match[1]);
  }

  const cf = (request as any)?.cf || {};
  const city = sanitizePromptText(String(cf?.city || "")).trim();
  const region = sanitizePromptText(String(cf?.region || "")).trim();
  const country = sanitizePromptText(String(cf?.country || "")).trim();
  if (city && country) {
    return `${city}, ${country}`;
  }
  if (region && country) {
    return `${region}, ${country}`;
  }
  return "New York";
}

async function fetchWeatherForLocation(location: string): Promise<InternetWeatherResult | null> {
  const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`;
  const geoResponse = await fetch(geoUrl, { method: "GET" });
  if (!geoResponse.ok) return null;

  const geoData = (await geoResponse.json()) as any;
  const first = Array.isArray(geoData?.results) ? geoData.results[0] : null;
  if (!first) return null;

  const latitude = Number(first.latitude);
  const longitude = Number(first.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const locationLabel = [first.name, first.admin1, first.country].filter(Boolean).join(", ");
  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&timezone=auto`;
  const weatherResponse = await fetch(weatherUrl, { method: "GET" });
  if (!weatherResponse.ok) return null;

  const weatherData = (await weatherResponse.json()) as any;
  const current = weatherData?.current_weather;
  if (!current) return null;

  return {
    location: sanitizePromptText(String(locationLabel || location)),
    latitude,
    longitude,
    temperatureC: Number(current.temperature),
    windSpeedKmh: Number(current.windspeed),
    weatherCode: Number(current.weathercode),
    observationTime: sanitizePromptText(String(current.time || "")),
    timezone: sanitizePromptText(String(weatherData?.timezone || ""))
  };
}

function stripHtmlToText(html: string): string {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeInspectUrl(rawUrl: string): string | null {
  const value = String(rawUrl || "").trim();
  if (!value) return null;
  try {
    const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    const url = new URL(withScheme);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

async function inspectWebsite(urlInput: string): Promise<InternetInspectResult | null> {
  const normalizedUrl = normalizeInspectUrl(urlInput);
  if (!normalizedUrl) return null;

  const response = await fetch(normalizedUrl, {
    method: "GET",
    headers: {
      "User-Agent": "OmniAi/1.0 (+internet-inspector)"
    }
  });
  if (!response.ok) return null;

  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  const bodyText = await response.text();
  const titleMatch = bodyText.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = sanitizePromptText(titleMatch?.[1] || normalizedUrl);

  const text = contentType.includes("html") ? stripHtmlToText(bodyText) : sanitizePromptText(bodyText);
  const excerpt = text.slice(0, 280);
  const contentPreview = text.slice(0, 1600);

  return {
    url: normalizedUrl,
    title: title || normalizedUrl,
    excerpt,
    contentPreview
  };
}

function toLearningFacts(hits: InternetSearchHit[]): InternetLearningFact[] {
  return (hits || []).slice(0, 5).map((hit) => ({
    title: sanitizePromptText(String(hit.title || "")).slice(0, 180),
    snippet: sanitizePromptText(String(hit.snippet || "")).slice(0, 420),
    url: sanitizePromptText(String(hit.url || "")).slice(0, 360),
    source: hit.source
  })).filter((fact) => Boolean(fact.title && fact.url));
}

async function loadInternetLearningStore(env: Env): Promise<InternetLearningStore> {
  if (!env.MEMORY) {
    return { updatedAt: Date.now(), entries: [] };
  }

  const raw = await env.MEMORY.get(INTERNET_LEARNING_KEY);
  if (!raw) {
    return { updatedAt: Date.now(), entries: [] };
  }

  try {
    const parsed = JSON.parse(raw) as InternetLearningStore;
    const entries = Array.isArray(parsed?.entries) ? parsed.entries : [];
    return {
      updatedAt: Number(parsed?.updatedAt || Date.now()),
      entries: entries
        .map((entry) => ({
          id: sanitizePromptText(String(entry?.id || "")).slice(0, 90),
          ts: Number(entry?.ts || 0),
          mode: sanitizePromptText(String(entry?.mode || "auto")).toLowerCase(),
          query: sanitizePromptText(String(entry?.query || "")).slice(0, 300),
          facts: Array.isArray(entry?.facts)
            ? entry.facts.map((fact): InternetLearningFact => ({
                title: sanitizePromptText(String(fact?.title || "")).slice(0, 180),
                snippet: sanitizePromptText(String(fact?.snippet || "")).slice(0, 420),
                url: sanitizePromptText(String(fact?.url || "")).slice(0, 360),
                source: fact?.source === "wikipedia" ? "wikipedia" : "duckduckgo"
              })).filter((fact) => Boolean(fact.title && fact.url))
            : []
        }))
        .filter((entry) => Boolean(entry.id && entry.query))
    };
  } catch {
    return { updatedAt: Date.now(), entries: [] };
  }
}

async function saveInternetLearningStore(env: Env, store: InternetLearningStore): Promise<void> {
  if (!env.MEMORY) return;
  await env.MEMORY.put(INTERNET_LEARNING_KEY, JSON.stringify(store));
}

async function recordInternetLearning(env: Env, mode: string, query: string, hits: InternetSearchHit[]): Promise<void> {
  if (!env.MEMORY) return;
  const normalizedQuery = sanitizePromptText(String(query || "")).trim();
  if (!normalizedQuery) return;

  const facts = toLearningFacts(hits);
  if (!facts.length) return;

  const store = await loadInternetLearningStore(env);
  const entry: InternetLearningEntry = {
    id: crypto.randomUUID(),
    ts: Date.now(),
    mode: normalizeInternetMode(mode),
    query: normalizedQuery,
    facts
  };

  const nextEntries = [entry, ...(store.entries || [])].slice(0, INTERNET_LEARNING_MAX_ENTRIES);
  await saveInternetLearningStore(env, {
    updatedAt: Date.now(),
    entries: nextEntries
  });
}

function tokenizeForLearning(text: string): string[] {
  return String(text || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4)
    .slice(0, 30);
}

function scoreLearningEntry(entry: InternetLearningEntry, mode: string, queryTokens: string[]): number {
  let score = 0;
  if (entry.mode === normalizeInternetMode(mode)) score += 3;

  const haystack = `${entry.query} ${entry.facts.map((fact) => `${fact.title} ${fact.snippet}`).join(" ")}`.toLowerCase();
  for (const token of queryTokens) {
    if (haystack.includes(token)) score += 1;
  }

  return score;
}

async function getInternetLearningContext(env: Env, mode: string, query: string, limit = 4): Promise<string> {
  const store = await loadInternetLearningStore(env);
  const entries = Array.isArray(store.entries) ? store.entries : [];
  if (!entries.length) return "";

  const tokens = tokenizeForLearning(query);
  const ranked = entries
    .map((entry) => ({ entry, score: scoreLearningEntry(entry, mode, tokens) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, limit));

  if (!ranked.length) return "";

  return ranked
    .map(({ entry }, index) => {
      const topFacts = entry.facts.slice(0, 2)
        .map((fact) => `- [${fact.source}] ${fact.title}: ${fact.snippet} (${fact.url})`)
        .join("\n");
      return `(${index + 1}) mode=${entry.mode}, query=${entry.query}\n${topFacts}`;
    })
    .join("\n\n---\n\n");
}

function makeContextSystemMessage(label: string, content: string): OmniMessage {
  return {
    role: "system",
    content: `[${label}]\n${content}`
  };
}

function resolveSessionId(request: Request): string {
  const url = new URL(request.url);
  const headerSession = String(request.headers.get("x-omni-session-id") || "").trim();
  const querySession = String(url.searchParams.get("sid") || "").trim();
  const raw = headerSession || querySession || "anon";
  return raw.replace(/[^a-zA-Z0-9:_-]/g, "").slice(0, 120) || "anon";
}

function isAdminAuthorized(request: Request, env: Env): boolean {
  const explicitEnv = String(env.OMNI_ENV || "").trim().toLowerCase();
  const isProduction = explicitEnv === "production";
  const configured = String(env.OMNI_ADMIN_KEY || "").trim();
  if (!configured) return !isProduction;

  const provided = String(request.headers.get("x-omni-admin-key") || "").trim();
  return provided.length > 0 && provided === configured;
}

function resolveInternalMindMode(value: string): InternalMindMode | null {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "improvement" || normalized === "patch" || normalized === "tasks") {
    return normalized;
  }
  return null;
}

function buildInternalMindImprovementResponse(payload: InternalMindRequestBody): Record<string, unknown> {
  const evaluation = payload?.evaluation || {};
  const sessionId = sanitizePromptText(String(evaluation.sessionId || "")).trim() || "unknown";
  const score = clamp(Number(evaluation.score || 0.78), 0, 1);
  const qualityScore = clamp(Number(evaluation.qualityScore || Math.min(1, score + 0.03)), 0, 1);
  const latencyScore = clamp(Number(evaluation.latencyScore || Math.max(0, score - 0.05)), 0, 1);
  const reliabilityScore = clamp(Number(evaluation.reliabilityScore || score), 0, 1);
  const safetyScore = clamp(Number(evaluation.safetyScore || Math.min(1, score + 0.08)), 0, 1);

  const issues = [
    ...(Array.isArray(evaluation.issues) ? evaluation.issues : []),
    ...(Array.isArray(evaluation.findings) ? evaluation.findings : [])
  ]
    .map((issue) => sanitizePromptText(String(issue || "")).trim())
    .filter(Boolean)
    .slice(0, 8);

  const normalizedIssues = issues.length
    ? issues
    : [
        "Session evaluation did not provide explicit issues; monitor next run for concrete drift signals."
      ];

  const proposals: Array<Record<string, unknown>> = [];
  if (qualityScore < 0.8) {
    proposals.push({
      type: "prompt",
      area: "response-quality",
      summary: "Tighten response-executability guidance in system prompts",
      details: "Require explicit file paths, concrete commands, and measurable acceptance criteria in generated plans.",
      safeToApply: true
    });
  }

  if (latencyScore < 0.72 || reliabilityScore < 0.9) {
    proposals.push({
      type: "task-token",
      area: "runtime-reliability",
      summary: "Create reliability hardening task token from mind evaluation",
      details: "Track retries, transient failure handling, and fallback path consistency across critical routes.",
      safeToApply: true,
      taskToken: {
        type: "refactor",
        summary: "Harden reliability and fallback handling in critical routes",
        contextFiles: ["src/index.ts", "src/mind/evaluators/sessionEvaluator.ts"],
        acceptanceCriteria: [
          "Reliability score recovers above 0.90 in subsequent sampled sessions",
          "No repeated transient-failure issue appears in two consecutive evaluations"
        ]
      }
    });
  }

  if (safetyScore < 0.98) {
    proposals.push({
      type: "task-token",
      area: "safety",
      summary: "Generate safety review token for policy boundary verification",
      details: "Review moderation classification traces and policy gate ordering for consistency.",
      safeToApply: false,
      taskToken: {
        type: "research",
        summary: "Audit safety gate ordering and moderation traces",
        contextFiles: ["src/index.ts", "codex/20-protocols.md"],
        acceptanceCriteria: [
          "Safety gate ordering documented",
          "Policy boundary tests added to maintenance checklist"
        ]
      }
    });
  }

  if (!proposals.length) {
    proposals.push({
      type: "task-token",
      area: "codex-update",
      summary: "Record healthy mind-evaluation snapshot",
      details: "No immediate corrective action required; keep trend monitoring active.",
      safeToApply: true,
      taskToken: {
        type: "codex-update",
        summary: "Append healthy internal mind-evaluation snapshot",
        contextFiles: ["codex/40-decisions"],
        acceptanceCriteria: [
          "Snapshot includes score breakdown and top findings",
          "No unresolved high-priority token remains active"
        ]
      }
    });
  }

  return {
    mode: "improvement",
    sessionId,
    score,
    metrics: {
      qualityScore,
      latencyScore,
      reliabilityScore,
      safetyScore
    },
    issues: normalizedIssues,
    proposals
  };
}

function buildInternalMindPatchResponse(payload: InternalMindRequestBody): Record<string, unknown> {
  const errorLog = sanitizePromptText(String(payload?.errorLog || "")).trim() || "No error log provided.";
  const contextFiles = Array.isArray(payload?.context?.files) ? payload.context.files : [];
  const primaryFile = contextFiles
    .map((file) => sanitizePromptText(String(file?.path || "")).trim())
    .find(Boolean) || "src/index.ts";

  const explanation =
    "The failure likely comes from an unguarded assumption in the failing path; introduce validation guards and safe fallbacks before dereferencing optional fields.";

  const diff = [
    `diff --git a/${primaryFile} b/${primaryFile}`,
    "index 0000000..1111111 100644",
    `--- a/${primaryFile}`,
    `+++ b/${primaryFile}`,
    "@@ -1,3 +1,8 @@",
    "+// TODO: apply targeted guard rails based on captured error trace",
    "+// 1) validate required fields before use",
    "+// 2) short-circuit with structured error response on invalid state",
    "+// 3) preserve existing safety gates and public interfaces"
  ].join("\n");

  return {
    mode: "patch",
    explanation,
    diff,
    traceExcerpt: errorLog.slice(0, 1200)
  };
}

function buildInternalMindTasksResponse(payload: InternalMindRequestBody): Record<string, unknown> {
  const issues = [
    ...(Array.isArray(payload?.issues) ? payload.issues : []),
    ...(Array.isArray(payload?.codexGaps) ? payload.codexGaps : [])
  ]
    .map((entry) => sanitizePromptText(String(entry || "")).trim())
    .filter(Boolean)
    .slice(0, 8);

  const taskSeeds = issues.length
    ? issues
    : [
        "No explicit issues supplied; generate a codex maintenance and observability task."
      ];

  const tasks = taskSeeds.map((issue, index) => ({
    type: index === 0 ? "feature" : "codex-update",
    summary: issue.length > 140 ? `${issue.slice(0, 137)}...` : issue,
    contextFiles: index === 0
      ? ["src/mind/evaluators/sessionEvaluator.ts", "src/mind/evaluators/improvementProposer.ts"]
      : ["codex/20-protocols.md"],
    acceptanceCriteria: index === 0
      ? [
          "Issue is translated into a concrete implementation step",
          "Result is traceable in codex decision history"
        ]
      : [
          "Protocol documentation updated for the identified gap",
          "Follow-up verification command is documented"
        ]
  }));

  return {
    mode: "tasks",
    tasks
  };
}

function getBackgroundReadinessStatus(env: Env): {
  ready: boolean;
  checks: Array<{ name: string; ok: boolean; detail: string }>;
} {
  const explicitEnv = String(env.OMNI_ENV || "").trim().toLowerCase();
  const isProduction = explicitEnv === "production";
  const adminKey = String(env.OMNI_ADMIN_KEY || "").trim();

  const checks = [
    {
      name: "env-set",
      ok: explicitEnv.length > 0,
      detail: explicitEnv.length > 0 ? `OMNI_ENV=${explicitEnv}` : "OMNI_ENV is not set"
    },
    {
      name: "admin-key",
      ok: !isProduction || adminKey.length >= 16,
      detail:
        !isProduction || adminKey.length >= 16
          ? "OMNI_ADMIN_KEY configured for production protected endpoints"
          : "OMNI_ADMIN_KEY missing or weak for production"
    },
    {
      name: "memory-kv",
      ok: Boolean(env.MEMORY),
      detail: env.MEMORY ? "MEMORY KV binding present" : "MEMORY KV binding missing"
    },
    {
      name: "mind-kv",
      ok: Boolean(env.MIND),
      detail: env.MIND ? "MIND KV binding present" : "MIND KV binding missing"
    },
    {
      name: "ai-binding",
      ok: Boolean(env.AI),
      detail: env.AI ? "AI binding present" : "AI binding missing"
    },
    {
      name: "assets-binding",
      ok: Boolean(env.ASSETS),
      detail: env.ASSETS ? "ASSETS binding present" : "ASSETS binding missing"
    }
  ];

  return {
    ready: checks.every((check) => check.ok),
    checks
  };
}

async function getReleaseSpecPayload(env: Env): Promise<Record<string, unknown>> {
  const release = {
    name: "Omni Ai",
    version: "1.0.0",
    date: "2026-02-26",
    lineage: ["Omni Ai"],
    recognitionCycle: "initiated"
  };

  let autonomyStatus: Record<string, unknown> | null = null;
  try {
    const status = await getMaintenanceStatus(env);
    autonomyStatus = {
      health: status.health,
      drift: status.drift,
      autonomy: status.autonomy,
      maintenance: status.maintenance
    };
  } catch {
    autonomyStatus = null;
  }

  const readiness = getBackgroundReadinessStatus(env);
  const readinessSnapshot = {
    ready: readiness.ready,
    failedChecks: readiness.checks
      .filter((check) => !check.ok)
      .map((check) => ({ name: check.name, detail: check.detail }))
  };

  return {
    release,
    capabilities: {
      identity: true,
      reasoning: true,
      memory: true,
      multimodal: true,
      behavior: true,
      autonomy: true,
      frontendMindState: true
    },
    endpoints: {
      omni: "/api/omni",
      image: "/api/image",
      maintenanceStatus: "/api/maintenance/status",
      maintenanceRun: "/api/maintenance/run",
      releaseSpec: "/api/release/spec"
    },
    publicArtifacts: {
      declaration: "/omni-ai-declaration.md",
      manifest: "/omni-ai-release.json",
      specDoc: "/OMNI_AI_RELEASE_SPEC.md"
    },
    runtime: autonomyStatus
      ? {
          ...autonomyStatus,
          readiness: readinessSnapshot
        }
      : {
          readiness: readinessSnapshot
        }
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
  if (lower.includes("park")) {
    return "park environment matching the prompt, natural landscape continuity";
  }
  if (lower.includes("bedroom") || lower.includes("room")) {
    return "cozy interior, detailed furniture, realistic lighting";
  }
  if (lower.includes("forest")) {
    return "dense trees, atmospheric fog, grounded natural lighting";
  }
  if (lower.includes("city")) {
    return "urban environment, buildings, grounded textures, depth and perspective";
  }
  return "coherent environment matching the subject and mood";
}

function inferTimeIntent(prompt: string): TimeIntent {
  const lower = String(prompt || "").toLowerCase();

  if (/(bedroom|room|office|studio|kitchen|indoor|interior)/.test(lower)) {
    return "indoor";
  }

  if (/(night|midnight|starlight|starry|nighttime)/.test(lower)) {
    return "night";
  }

  if (/(sunset|golden hour|dusk|twilight)/.test(lower)) {
    return "sunset";
  }

  if (/(day|daytime|sunlight|morning|noon|afternoon)/.test(lower)) {
    return "day";
  }

  return "neutral";
}

function buildTimeDirective(intent: TimeIntent): string {
  if (intent === "night") {
    return "nighttime scene when appropriate, coherent low-light rendering";
  }

  if (intent === "sunset") {
    return "sunset lighting, warm sky tones";
  }

  if (intent === "day") {
    return "daytime lighting, natural sunlight, clear atmosphere";
  }

  if (intent === "indoor") {
    return "interior lighting setup, practical lights, no night sky elements unless requested";
  }

  return "neutral natural lighting, balanced exposure";
}

function getStylePack(name: string): { name: string; tags: string[] } {
  if (!name) {
    return { name: "none", tags: [] };
  }
  return OMNI_STYLE_PACKS[name] || { name: "none", tags: [] };
}

function promptRequestsPeople(prompt: string): boolean {
  const lower = String(prompt || "").toLowerCase();
  return /\b(person|people|character|characters|man|woman|boy|girl|child|children|human|humans|crowd|portrait|selfie|face|worker|hiker|runner|couple|family)\b/.test(lower);
}

function buildStrictPromptDirective(): string {
  return "strict prompt fidelity: include only elements explicitly requested by the user; do not add extra subjects, characters, objects, text, logos, or overlays";
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

function inferStyleFromPrompt(prompt: string): string {
  const lower = String(prompt || "").toLowerCase();
  if (!lower) return "";

  const candidates: Array<{ style: string; pattern: RegExp }> = [
    { style: "hyper-real", pattern: /\b(hyper\s*real|hyperreal|photo\s*real|photoreal|photorealistic|photographic|photo[-\s]?realistic)\b/i },
    { style: "semi-realistic", pattern: /\b(semi\s*realistic|stylized\s*realism|semi\s*real)\b/i },
    { style: "vector", pattern: /\b(vector\s*art|flat\s*vector|flat\s*design|svg\s*style)\b/i },
    { style: "logo", pattern: /\b(logo\s*design|brand\s*mark|logomark|wordmark)\b/i },
    { style: "monochrome", pattern: /\b(monochrome|black\s*and\s*white|grayscale|greyscale)\b/i },
    { style: "sketch", pattern: /\b(sketch|pencil\s*sketch|graphite|line\s*drawing|hand\s*drawn)\b/i },
    { style: "vfx", pattern: /\b(vfx|cinematic\s*vfx|glitch\s*effect|holographic|particle\s*effects)\b/i },
    { style: "text", pattern: /\b(typography|text\s*design|lettering|word\s*art)\b/i },
    { style: "3d", pattern: /\b(3d|three\s*dimensional|cgi|rendered\s*3d)\b/i },
    { style: "realistic", pattern: /\b(realistic|lifelike|natural\s*imperfections|photo\s*quality)\b/i }
  ];

  for (const candidate of candidates) {
    if (candidate.pattern.test(lower)) {
      return candidate.style;
    }
  }

  return "";
}

function inferCameraFromPrompt(prompt: string): string {
  const lower = String(prompt || "").toLowerCase();
  if (!lower) return "";

  if (/\b(85mm|portrait lens|portrait shot|headshot|bokeh portrait)\b/i.test(lower)) return "portrait-85mm";
  if (/\b(35mm|wide angle|wide-angle|environmental portrait|street photo)\b/i.test(lower)) return "wide-35mm";
  if (/\b(macro|close-up macro|extreme close-up|micro detail|micro-detail)\b/i.test(lower)) return "macro";
  if (/\b(135mm|telephoto|compressed background|long lens)\b/i.test(lower)) return "telephoto-135mm";

  return "";
}

function inferLightingFromPrompt(prompt: string): string {
  const lower = String(prompt || "").toLowerCase();
  if (!lower) return "";

  if (/\b(soft studio|beauty light|diffused studio|softbox)\b/i.test(lower)) return "studio-soft";
  if (/\b(hard studio|hard light|sharp shadows|high contrast studio)\b/i.test(lower)) return "studio-hard";
  if (/\b(natural daylight|daylight|golden hour daylight|outdoor sunlight)\b/i.test(lower)) return "natural-daylight";
  if (/\b(low[-\s]?key|moody lighting|dramatic shadows|cinematic low key)\b/i.test(lower)) return "cinematic-lowkey";

  return "";
}

function inferMaterialsFromPrompt(prompt: string): string[] {
  const lower = String(prompt || "").toLowerCase();
  if (!lower) return [];

  const inferred: string[] = [];
  if (/\b(skin|portrait skin|face texture|pores)\b/i.test(lower)) inferred.push("skin");
  if (/\b(fabric|cloth|textile|cotton|silk|denim|wool)\b/i.test(lower)) inferred.push("fabric");
  if (/\b(metal|chrome|steel|iron|aluminum|brushed metal)\b/i.test(lower)) inferred.push("metal");
  if (/\b(glass|crystal|transparent|refraction|window pane)\b/i.test(lower)) inferred.push("glass");

  return [...new Set(inferred)];
}

function orchestrateOmniImagePrompt(userPrompt: string, options: OmniImageOptions): OmniImagePromptData {
  const tokens = tokenizePrompt(userPrompt);
  const sceneDescription = inferSceneDescription(userPrompt);
  const timeIntent = inferTimeIntent(userPrompt);
  const timeDirective = buildTimeDirective(timeIntent);
  const strictDirective = buildStrictPromptDirective();
  const selectedStylePack = getStylePack(options.stylePack || "");
  const styleAwarePrompt = assemblePrompt(userPrompt, options.stylePack || "", {
    camera: options.camera,
    lighting: options.lighting,
    materials: Array.isArray(options.materials) ? options.materials : undefined
  });

  const semanticExpansion = [styleAwarePrompt, sceneDescription, timeDirective, strictDirective].filter(Boolean).join(", ");
  const lawTags = buildLawPromptDirectives(options.laws);
  const lawInfluence = applyLawsToVisualInfluence(options.laws);
  const styleTags = selectedStylePack.tags || [];
  const technicalTags: string[] = [];

  const finalPrompt = [
    semanticExpansion,
    lawTags.join(", "),
    styleTags.join(", "),
    technicalTags.join(", ")
  ].filter(Boolean).join(", ");

  return {
    userPrompt,
    tokens,
    semanticExpansion,
    lawTags,
    lawInfluence,
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
  const timeIntent = inferTimeIntent(data.userPrompt);
  const explicitlyRequestsNight = timeIntent === "night";
  const includesPeople = promptRequestsPeople(data.userPrompt);
  const negativeTags = [...(data.negativeTags || []), ...OMNI_NEGATIVE_BASE];
  if (!lowerPrompt.includes("ocean") && !lowerPrompt.includes("sea") && !lowerPrompt.includes("beach")) {
    negativeTags.push(...OMNI_NEGATIVE_NO_OCEAN);
  }

  if (!explicitlyRequestsNight && !lowerPrompt.includes("night")) {
    negativeTags.push("no starry sky", "no nighttime atmosphere unless requested");
  }

  if (!includesPeople) {
    negativeTags.push(
      "no people",
      "no characters",
      "no human subjects",
      "no portraits",
      "no crowd"
    );
  }
  data.negativeTags = [...new Set(negativeTags)];

  const tags = [
    data.semanticExpansion,
    data.lawTags.join(", "),
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
  const match = String(value || "").trim().toLowerCase().match(/^(\d+)\s*[x×]\s*(\d+)$/i);
  if (!match) return { width: 1024, height: 1024 };
  return {
    width: clamp(Number(match[1]), 256, 8192),
    height: clamp(Number(match[2]), 256, 8192)
  };
}

function parseRatio(value: string): { ratioW: number; ratioH: number; label: string } {
  const normalized = String(value || "").trim().toLowerCase();
  const presets: Record<string, [number, number]> = {
    "1:1": [1, 1],
    "4:3": [4, 3],
    "3:4": [3, 4],
    "3:2": [3, 2],
    "2:3": [2, 3],
    "16:9": [16, 9],
    "9:16": [9, 16],
    "21:9": [21, 9],
    "9:21": [9, 21],
    "5:4": [5, 4],
    "4:5": [4, 5],
    "7:5": [7, 5],
    "5:7": [5, 7]
  };

  if (presets[normalized]) {
    const [ratioW, ratioH] = presets[normalized];
    return { ratioW, ratioH, label: normalized };
  }

  const match = normalized.match(/^(\d+)\s*[:/]\s*(\d+)$/);
  if (match) {
    const ratioW = clamp(Number(match[1]), 1, 64);
    const ratioH = clamp(Number(match[2]), 1, 64);
    return { ratioW, ratioH, label: `${ratioW}:${ratioH}` };
  }

  return { ratioW: 1, ratioH: 1, label: "1:1" };
}

function parseResolutionPreset(value: string, quality: string): number {
  const normalized = String(value || "").trim().toLowerCase();
  const presets: Record<string, number> = {
    "sd": 512,
    "hd": 1280,
    "fhd": 1920,
    "qhd": 2560,
    "4k": 3840,
    "5k": 5120,
    "6k": 6144,
    "8k": 7680
  };

  if (presets[normalized]) {
    return presets[normalized];
  }

  if (quality === "high") return 1280;
  if (quality === "ultra") return 2048;
  return 1024;
}

function deriveDimensionsFromRatio(ratio: string, resolution: string, quality: string): { width: number; height: number; ratio: string } {
  const ratioData = parseRatio(ratio);
  const maxSide = parseResolutionPreset(resolution, quality);

  let width = maxSide;
  let height = Math.round((maxSide * ratioData.ratioH) / ratioData.ratioW);

  if (height > maxSide) {
    height = maxSide;
    width = Math.round((maxSide * ratioData.ratioW) / ratioData.ratioH);
  }

  return {
    width: clamp(width, 256, 8192),
    height: clamp(height, 256, 8192),
    ratio: ratioData.label
  };
}

function selectImageModelConfig(
  styleId: string,
  quality: string | undefined,
  env: Env,
  requestedRatio?: string,
  requestedResolution?: string,
  requestedWidth?: number,
  requestedHeight?: number
): ImageModelConfig {
  const safeQuality = String(quality || "ultra").toLowerCase();
  const computed = deriveDimensionsFromRatio(requestedRatio || "1:1", requestedResolution || "", safeQuality);
  const explicitWidth = Number(requestedWidth);
  const explicitHeight = Number(requestedHeight);

  const width = Number.isFinite(explicitWidth) ? clamp(Math.floor(explicitWidth), 256, 8192) : computed.width;
  const height = Number.isFinite(explicitHeight) ? clamp(Math.floor(explicitHeight), 256, 8192) : computed.height;

  return {
    model: env.MODEL_IMAGE || "@cf/black-forest-labs/flux-1-schnell",
    styleId: styleId || "mythic_cinematic",
    width,
    height,
    ratio: requestedRatio || computed.ratio,
    resolution: `${width}x${height}`
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

async function generateOmniImageFromPrompt(env: Env, userPrompt: string, options: Partial<ImageRequestBody> = {}): Promise<OmniImageGenerationResult> {
  const promptText = sanitizePromptText(String(userPrompt || ""));
  if (!promptText) {
    throw new Error("Prompt is required");
  }

  const feedback = sanitizePromptText(String(options?.feedback || ""));
  const requestedStylePack = sanitizePromptText(String(options?.stylePack || "")).toLowerCase();
  const requestedLaws = Array.isArray(options?.laws)
    ? options.laws
        .map((law) => {
          const id = sanitizePromptText(String(law?.id || "")).toUpperCase();
          const mode = sanitizePromptText(String(law?.mode || "")).toLowerCase();
          const weight = Number(law?.weight);
          const normalizedMode: LawReference["mode"] =
            mode === "symbolic" || mode === "structural" || mode === "color" || mode === "motion"
              ? mode
              : undefined;
          return {
            id,
            mode: normalizedMode,
            weight: Number.isFinite(weight) ? Math.min(1, Math.max(0, weight)) : undefined
          };
        })
        .filter((law) => Boolean(law.id))
    : [];

  const requestedQuality = sanitizePromptText(String(options?.quality || "ultra")).toLowerCase() || "ultra";
  const promptInferredStyle = resolveStyleName(inferStyleFromPrompt(promptText));
  const visualReasoning = runVisualReasoning(promptText);
  const promptInferredCamera = inferCameraFromPrompt(promptText) || visualReasoning.cameraIntent;
  const promptInferredLighting = inferLightingFromPrompt(promptText) || visualReasoning.lightingIntent;
  const promptInferredMaterials = inferMaterialsFromPrompt(promptText);
  const effectiveStylePack = promptInferredStyle || requestedStylePack;
  const resolvedRenderingStyle = resolveStyleName(effectiveStylePack) || "auto";
  const requestedCameraRaw = sanitizePromptText(String(options?.camera || "")).toLowerCase();
  const requestedLightingRaw = sanitizePromptText(String(options?.lighting || "")).toLowerCase();
  const requestedMaterials = Array.isArray(options?.materials)
    ? options.materials.map((item) => sanitizePromptText(String(item || "")).toLowerCase()).filter(Boolean)
    : [];
  const effectiveCamera = promptInferredCamera || requestedCameraRaw || "portrait-85mm";
  const effectiveLighting = promptInferredLighting || requestedLightingRaw || "studio-soft";
  const effectiveMaterials = promptInferredMaterials.length
    ? promptInferredMaterials
    : requestedMaterials.length
      ? requestedMaterials
      : resolvedRenderingStyle === "hyper-real"
        ? ["skin"]
        : [];

  const requestedRatio = sanitizePromptText(String(options?.ratio || "1:1")) || "1:1";
  const requestedResolution = sanitizePromptText(String(options?.resolution || ""));
  const requestedWidth = Number(options?.width);
  const requestedHeight = Number(options?.height);
  const parsedSeed = Number(options?.seed);

  const orchestrated = orchestrateOmniImagePrompt(
    `${promptText}, visual reasoning: ${visualReasoning.directive}`,
    {
      mode: sanitizePromptText(String(options?.mode || "simple")).toLowerCase() || "simple",
      stylePack: effectiveStylePack,
      laws: requestedLaws,
      quality: requestedQuality,
      feedback,
      seed: Number.isFinite(parsedSeed) ? parsedSeed : undefined,
      camera: effectiveCamera,
      lighting: effectiveLighting,
      materials: effectiveMaterials
    }
  );

  const refined = refineOmniImagePrompt(orchestrated, {
    mode: sanitizePromptText(String(options?.mode || "simple")).toLowerCase() || "simple",
    stylePack: effectiveStylePack,
    laws: requestedLaws,
    quality: requestedQuality,
    feedback,
    seed: Number.isFinite(parsedSeed) ? parsedSeed : undefined,
    camera: effectiveCamera,
    lighting: effectiveLighting,
    materials: effectiveMaterials
  });

  const modelConfig = selectImageModelConfig(
    effectiveStylePack,
    requestedQuality,
    env,
    requestedRatio,
    requestedResolution,
    requestedWidth,
    requestedHeight
  );

  const rawImage = await env.AI.run(modelConfig.model, {
    prompt: refined.data.finalPrompt,
    width: modelConfig.width,
    height: modelConfig.height,
    seed: refined.finalOptions.seed
  });

  const normalized = await normalizeImageOutput(rawImage);
  const imageDataUrl = `data:${normalized.mimeType};base64,${bytesToBase64(normalized.bytes)}`;
  const filename = makeImageFilename(modelConfig.styleId);

  return {
    imageDataUrl,
    filename,
    model: modelConfig.model,
    metadata: {
      style_id: modelConfig.styleId,
      model: modelConfig.model,
      ratio: modelConfig.ratio,
      resolution: modelConfig.resolution,
      quality: requestedQuality,
      rendering_style: resolvedRenderingStyle,
      camera: effectiveCamera,
      lighting: effectiveLighting,
      materials: effectiveMaterials,
      visual_reasoning: visualReasoning,
      seed: refined.finalOptions.seed,
      prompt: {
        userPrompt: orchestrated.userPrompt,
        semanticExpansion: orchestrated.semanticExpansion,
        finalPrompt: refined.data.finalPrompt
      }
    }
  };
}

type Phase1VideoGenerationPayload = {
  result: any;
  previews: { keyframeUrls: string[] };
  createdAt: number;
};

function videoJobKey(jobId: string): string {
  return `${VIDEO_JOB_KEY_PREFIX}${jobId}`;
}

async function saveVideoJob(env: Env, job: OmniVideoJob): Promise<void> {
  if (!env.MEMORY) return;
  await env.MEMORY.put(videoJobKey(job.id), JSON.stringify(job), {
    expirationTtl: VIDEO_JOB_TTL_SEC
  });
}

async function readVideoJob(env: Env, jobId: string): Promise<OmniVideoJob | null> {
  if (!env.MEMORY) return null;
  const raw = await env.MEMORY.get(videoJobKey(jobId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as OmniVideoJob;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function coerceVideoQualityMode(value: unknown): VideoQualityMode {
  const normalized = String(value || "BALANCED").toUpperCase();
  return normalized === "CRISP_SHORT" || normalized === "LONG_SOFT" || normalized === "BALANCED"
    ? (normalized as VideoQualityMode)
    : "BALANCED";
}

function coerceVideoFormat(value: unknown): VideoFormat {
  const normalized = String(value || "both").toLowerCase();
  return normalized === "mp4" || normalized === "gif" || normalized === "both"
    ? (normalized as VideoFormat)
    : "both";
}

function isBrowserPlayableVideoUrl(value: unknown): boolean {
  const url = String(value || "").trim();
  if (!url) return false;
  if (url.startsWith("data:video/") || url.startsWith("data:image/gif")) return true;
  if (url.startsWith("blob:") || url.startsWith("http://") || url.startsWith("https://") || url.startsWith("/")) {
    return true;
  }
  return false;
}

async function runPhase1VideoGeneration(
  env: Env,
  prompt: string,
  body: VideoPhase1RequestBody
): Promise<Phase1VideoGenerationPayload> {
  const qualityMode = coerceVideoQualityMode(body?.qualityMode);
  const format = coerceVideoFormat(body?.format);
  const maxSizeMB = clamp(Number(body?.maxSizeMB || 2), 0.3, 8);
  const requestedDurationSec = clamp(Number((body as VideoGenerateRequestBody)?.durationSeconds ?? body?.durationSec ?? 4), 2, 8);
  const referenceImages = Array.isArray(body?.referenceImages)
    ? body.referenceImages.map((item) => sanitizePromptText(String(item || ""))).filter(Boolean)
    : [];

  const keyframeUrlById = new Map<string, string>();

  const imageEngine = {
    generateImage: async (requestPayload: {
      prompt: string;
      styleTags?: string[];
      referenceImages?: string[];
      styleTokenIds?: string[];
      identityTokenId?: string;
      contextTokenIds?: string[];
    }) => {
      const stylePack = sanitizePromptText(String(requestPayload.styleTags?.[0] || "")).toLowerCase();
      const referenceImage = Array.isArray(requestPayload.referenceImages) && requestPayload.referenceImages.length
        ? sanitizePromptText(String(requestPayload.referenceImages[0] || ""))
        : "";
      const tokenHints = [
        ...(Array.isArray(requestPayload.styleTokenIds) ? requestPayload.styleTokenIds : []),
        ...(requestPayload.identityTokenId ? [requestPayload.identityTokenId] : []),
        ...(Array.isArray(requestPayload.contextTokenIds) ? requestPayload.contextTokenIds : []),
        ...(referenceImage ? [referenceImage] : [])
      ]
        .map((item) => sanitizePromptText(String(item || "")))
        .filter(Boolean)
        .slice(0, 8);

      const generated = await generateOmniImageFromPrompt(env, requestPayload.prompt, {
        mode: "simple",
        stylePack,
        feedback: [requestPayload.styleTags?.join(", ") || "", tokenHints.join(" | ")].filter(Boolean).join(" | "),
        quality: qualityMode === "CRISP_SHORT" ? "ultra" : qualityMode === "LONG_SOFT" ? "high" : "ultra"
      });

      const generatedId = `kf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      keyframeUrlById.set(generatedId, generated.imageDataUrl);

      return {
        id: generatedId,
        url: generated.imageDataUrl
      };
    }
  };

  const engine = new OmniVideoEnginePhase1Impl(
    imageEngine,
    new LinearHoldFrameInterpolator(),
    new BudgetAwareEstimatorEncoder(),
    {
      plannerLLMCall: async ({ systemPrompt, userPrompt }) => {
        const plannerRoute = chooseModelForTask("auto", prompt, "visual");
        const plannerResult = await omniBrainLoop(env, {
          mode: "visual",
          model: plannerRoute.selectedModel,
          messages: [
            { role: "system", content: String(systemPrompt || "") },
            { role: "user", content: String(userPrompt || "") }
          ],
          maxOutputTokens: 1400
        });
        return String(plannerResult?.response || "");
      },
      styleRegistry: VIDEO_STYLE_REGISTRY
    }
  );

  const result = await engine.generateVideoClipPhase1({
    prompt,
    dialogueScript: body?.dialogueScript,
    referenceImages,
    durationSec: requestedDurationSec,
    qualityMode,
    maxSizeMB,
    format
  });

  const keyframeUrls = Array.isArray(result?.meta?.keyframes)
    ? result.meta.keyframes
        .map((keyframe: any) => keyframeUrlById.get(String(keyframe?.imageId || "")) || "")
        .filter(Boolean)
    : [];

  return {
    result,
    previews: {
      keyframeUrls
    },
    createdAt: Date.now()
  };
}

async function processVideoJob(
  env: Env,
  logger: OmniLogger,
  jobId: string,
  body: VideoGenerateRequestBody
): Promise<void> {
  const current = await readVideoJob(env, jobId);
  if (!current) return;

  const running: OmniVideoJob = {
    ...current,
    status: "running"
  };
  await saveVideoJob(env, running);

  try {
    const payload = await runPhase1VideoGeneration(env, current.prompt, body);
    const result = payload.result;
    const succeeded: OmniVideoJob = {
      ...running,
      status: "succeeded",
      durationSeconds: Number(result?.meta?.durationSec || running.durationSeconds || 0),
      width: Number(result?.meta?.resolution?.width || running.width || 512),
      height: Number(result?.meta?.resolution?.height || running.height || 512),
      fps: Number(result?.meta?.fps || running.fps || 12),
      mp4Url: isBrowserPlayableVideoUrl(result?.mp4Url) ? String(result?.mp4Url || "") : undefined,
      gifUrl: isBrowserPlayableVideoUrl(result?.gifUrl) ? String(result?.gifUrl || "") : undefined,
      thumbnailUrl: payload.previews.keyframeUrls[0] || undefined,
      keyframePreviewUrls: payload.previews.keyframeUrls
    };
    await saveVideoJob(env, succeeded);
  } catch (error: any) {
    logger.error("video_job_processing_error", error);
    const failed: OmniVideoJob = {
      ...running,
      status: "failed",
      errorMessage: String(error?.message || "Video generation failed")
    };
    await saveVideoJob(env, failed);
  }
}

// Warmup connections on first request (non-blocking)
let connectionsWarmedUp = false;
let lastReadinessAuditAt = 0;
let lastReadinessSignature = "";
const READINESS_AUDIT_INTERVAL_MS = 5 * 60 * 1000;

function runBackgroundReadinessAudit(env: Env, logger: OmniLogger): void {
  const now = Date.now();
  if (now - lastReadinessAuditAt < READINESS_AUDIT_INTERVAL_MS) {
    return;
  }

  lastReadinessAuditAt = now;

  const readiness = getBackgroundReadinessStatus(env);
  const failed = readiness.checks.filter((check) => !check.ok);
  const signature = readiness.ready
    ? "ready"
    : failed.map((check) => `${check.name}:${check.detail}`).join("|");

  if (signature === lastReadinessSignature && readiness.ready) {
    return;
  }

  lastReadinessSignature = signature;
  logger.log("release_readiness_background", {
    ready: readiness.ready,
    failedChecks: failed,
    checkedAt: now
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const logger = new OmniLogger(env);

    // Warmup API connections on first request (non-blocking)
    if (!connectionsWarmedUp) {
      connectionsWarmedUp = true;
      warmupConnections(env).catch(() => {}); // Fire and forget
    }

    runBackgroundReadinessAudit(env, logger);

    try {
      const url = new URL(request.url);
      const isApiRoute =
        url.pathname === "/api/omni" ||
        url.pathname === "/api/image" ||
        url.pathname === "/api/video/generate" ||
        url.pathname === "/api/video/phase1" ||
        url.pathname.startsWith("/api/video/job/") ||
        url.pathname === "/api/internet/search" ||
        url.pathname === "/api/internet/learning" ||
        url.pathname === "/api/internet/weather" ||
        url.pathname === "/api/internet/inspect" ||
        url.pathname === "/api/human-verify" ||
        url.pathname === "/api/human-verify/config" ||
        url.pathname === "/api/human-verify/challenge" ||
        url.pathname === "/api/laws" ||
        url.pathname === "/api/search" ||
        url.pathname === "/api/preferences" ||
        url.pathname === "/api/stats" ||
        url.pathname === "/api/maintenance/run" ||
        url.pathname === "/api/maintenance/status" ||
        url.pathname === "/api/release/spec" ||
        url.pathname === "/internal/mind";
        
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

      if (url.pathname === "/api/internet/search" && request.method === "GET") {
        const query = sanitizePromptText(String(url.searchParams.get("q") || "")).trim();
        const mode = sanitizePromptText(String(url.searchParams.get("mode") || "auto")).trim().toLowerCase();
        if (!query) {
          return new Response(
            JSON.stringify({ query, mode, hits: [] }),
            {
              headers: {
                ...CORS_HEADERS,
                "Content-Type": "application/json"
              }
            }
          );
        }

        const { profile, hits } = await performModeAwareInternetSearch(mode, query);
        await recordInternetLearning(env, mode, query, hits);
        return new Response(
          JSON.stringify({
            query,
            mode: normalizeInternetMode(mode),
            profile,
            count: hits.length,
            hits
          }),
          {
            headers: {
              ...CORS_HEADERS,
              "Content-Type": "application/json"
            }
          }
        );
      }

      if (url.pathname === "/api/internet/learning" && request.method === "GET") {
        const mode = sanitizePromptText(String(url.searchParams.get("mode") || "")).trim().toLowerCase();
        const query = sanitizePromptText(String(url.searchParams.get("q") || "")).trim();
        const store = await loadInternetLearningStore(env);
        const allEntries = Array.isArray(store.entries) ? store.entries : [];

        const filtered = allEntries.filter((entry) => {
          const modePass = mode ? entry.mode === normalizeInternetMode(mode) : true;
          const queryPass = query
            ? `${entry.query} ${entry.facts.map((fact) => `${fact.title} ${fact.snippet}`).join(" ")}`
                .toLowerCase()
                .includes(query.toLowerCase())
            : true;
          return modePass && queryPass;
        });

        return new Response(
          JSON.stringify({
            ok: true,
            updatedAt: store.updatedAt,
            count: filtered.length,
            entries: filtered.slice(0, 25)
          }),
          {
            headers: {
              ...CORS_HEADERS,
              "Content-Type": "application/json"
            }
          }
        );
      }

      if (url.pathname === "/api/internet/weather" && request.method === "GET") {
        const location = sanitizePromptText(String(url.searchParams.get("location") || "")).trim();
        const fallbackLocation = inferWeatherLocation(location || "weather", request);
        const weather = await fetchWeatherForLocation(location || fallbackLocation);

        if (!weather) {
          return new Response(
            JSON.stringify({ ok: false, error: "Weather lookup failed for the requested location." }),
            {
              status: 404,
              headers: {
                ...CORS_HEADERS,
                "Content-Type": "application/json"
              }
            }
          );
        }

        return new Response(
          JSON.stringify({
            ok: true,
            weather
          }),
          {
            headers: {
              ...CORS_HEADERS,
              "Content-Type": "application/json"
            }
          }
        );
      }

      if (url.pathname === "/api/internet/inspect" && request.method === "GET") {
        const target = sanitizePromptText(String(url.searchParams.get("url") || "")).trim();
        if (!target) {
          return new Response(JSON.stringify({ ok: false, error: "A url query parameter is required." }), {
            status: 400,
            headers: {
              ...CORS_HEADERS,
              "Content-Type": "application/json"
            }
          });
        }

        const inspection = await inspectWebsite(target);
        if (!inspection) {
          return new Response(JSON.stringify({ ok: false, error: "Unable to inspect requested site." }), {
            status: 400,
            headers: {
              ...CORS_HEADERS,
              "Content-Type": "application/json"
            }
          });
        }

        return new Response(
          JSON.stringify({
            ok: true,
            inspection
          }),
          {
            headers: {
              ...CORS_HEADERS,
              "Content-Type": "application/json"
            }
          }
        );
      }

      if (url.pathname === "/api/laws" && request.method === "GET") {
        const id = String(url.searchParams.get("id") || "").trim().toUpperCase();
        const tag = String(url.searchParams.get("tag") || "").trim().toLowerCase();
        const domainRaw = String(url.searchParams.get("domain") || "").trim().toLowerCase();

        const validDomain = domainRaw === "quantum" || domainRaw === "cognitive" || domainRaw === "physiological"
          ? (domainRaw as LawDomain)
          : null;

        const result = id
          ? Laws.getById(id)
            ? [Laws.getById(id)]
            : []
          : tag
            ? Laws.getByTag(tag)
            : validDomain
              ? Laws.getByDomain(validDomain)
              : Laws.listAll();

        return new Response(JSON.stringify({
          filters: {
            id: id || null,
            tag: tag || null,
            domain: validDomain || null
          },
          count: result.length,
          stats: Laws.stats(),
          laws: result
        }), {
          headers: {
            ...CORS_HEADERS,
            "Content-Type": "application/json"
          }
        });
      }

      if (url.pathname === "/api/human-verify/config" && request.method === "GET") {
        const siteKey = String(env.TURNSTILE_SITE_KEY || "").trim();
        const hasSecret = String(env.TURNSTILE_SECRET_KEY || "").trim().length > 0;
        return new Response(
          JSON.stringify({
            siteKey,
            turnstileEnabled: Boolean(siteKey && hasSecret),
            fallbackChallengeEnabled: Boolean(env.MEMORY),
            methods: [
              ...(siteKey && hasSecret ? ["turnstile"] : []),
              ...(env.MEMORY ? ["challenge"] : [])
            ]
          }),
          {
            headers: {
              ...CORS_HEADERS,
              "Content-Type": "application/json"
            }
          }
        );
      }

      if (url.pathname === "/api/human-verify/challenge" && request.method === "GET") {
        if (!env.MEMORY) {
          return new Response(
            JSON.stringify({ ok: false, error: "Fallback challenge is unavailable." }),
            {
              status: 503,
              headers: {
                ...CORS_HEADERS,
                "Content-Type": "application/json"
              }
            }
          );
        }

        const challenge = await createHumanChallenge(env);
        return new Response(
          JSON.stringify({
            ok: true,
            challenge
          }),
          {
            headers: {
              ...CORS_HEADERS,
              "Content-Type": "application/json"
            }
          }
        );
      }

      if (url.pathname === "/api/human-verify" && request.method === "POST") {
        const payload = (await request.json().catch(() => ({}))) as HumanVerifyRequestBody;
        const token = sanitizePromptText(String(payload?.token || "")).trim();
        const challengeId = sanitizePromptText(String(payload?.challengeId || "")).trim();
        const challengeAnswer = sanitizePromptText(String(payload?.challengeAnswer || "")).trim();
        const year = Number(payload?.birthDate?.year);
        const month = Number(payload?.birthDate?.month);
        const day = Number(payload?.birthDate?.day);

        const yearIsValid = Number.isFinite(year) && year >= 1900 && year <= 2200;
        const monthIsValid = Number.isFinite(month) && month >= 1 && month <= 12;
        const dayIsValid = Number.isFinite(day) && day >= 1 && day <= 31;
        if (!yearIsValid || !monthIsValid || !dayIsValid) {
          return new Response(JSON.stringify({ ok: false, error: "A valid birth date is required." }), {
            status: 400,
            headers: {
              ...CORS_HEADERS,
              "Content-Type": "application/json"
            }
          });
        }

        const age = computeAgeFromBirthDate(year, month, day);
        if (!Number.isFinite(age) || age < 0) {
          return new Response(JSON.stringify({ ok: false, error: "Birth date is invalid for current time." }), {
            status: 400,
            headers: {
              ...CORS_HEADERS,
              "Content-Type": "application/json"
            }
          });
        }

        const hasTurnstileSecret = String(env.TURNSTILE_SECRET_KEY || "").trim().length > 0;
        const hasTurnstileSiteKey = String(env.TURNSTILE_SITE_KEY || "").trim().length > 0;
        const turnstileEnabled = hasTurnstileSecret && hasTurnstileSiteKey;
        const challengeEnabled = Boolean(env.MEMORY);

        if (!turnstileEnabled && !challengeEnabled) {
          return new Response(JSON.stringify({ ok: false, error: "No verification method is configured on the server." }), {
            status: 503,
            headers: {
              ...CORS_HEADERS,
              "Content-Type": "application/json"
            }
          });
        }

        let humanVerified = false;
        let verificationMethod = "none";

        if (turnstileEnabled && token) {
          humanVerified = await verifyTurnstileToken(request, env, token);
          if (humanVerified) {
            verificationMethod = "turnstile";
          }
        }

        if (!humanVerified && challengeEnabled && challengeId && challengeAnswer) {
          humanVerified = await verifyFallbackChallenge(env, challengeId, challengeAnswer);
          if (humanVerified) {
            verificationMethod = "challenge";
          }
        }

        if (!humanVerified) {
          return new Response(JSON.stringify({ ok: false, error: "Human verification failed. Complete Turnstile or solve the fallback challenge." }), {
            status: 403,
            headers: {
              ...CORS_HEADERS,
              "Content-Type": "application/json"
            }
          });
        }

        const isAdult = age >= 18;
        return new Response(
          JSON.stringify({
            ok: true,
            humanVerified: true,
            verificationMethod,
            age,
            isAdult,
            ageTier: isAdult ? "adult" : "minor",
            nsfwAccess: isAdult,
            illegalContentBlocked: true
          }),
          {
            headers: {
              ...CORS_HEADERS,
              "Content-Type": "application/json"
            }
          }
        );
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

      if (url.pathname === "/api/maintenance/status" && request.method === "GET") {
        if (!isAdminAuthorized(request, env)) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: {
              ...CORS_HEADERS,
              "Content-Type": "application/json"
            }
          });
        }

        const status = await getMaintenanceStatus(env);
        return new Response(JSON.stringify(status), {
          headers: {
            ...CORS_HEADERS,
            "Content-Type": "application/json"
          }
        });
      }

      if (url.pathname === "/api/release/spec" && request.method === "GET") {
        const spec = await getReleaseSpecPayload(env);
        return new Response(JSON.stringify(spec), {
          headers: {
            ...CORS_HEADERS,
            "Content-Type": "application/json"
          }
        });
      }

      if (url.pathname === "/api/maintenance/run" && request.method === "POST") {
        if (!isAdminAuthorized(request, env)) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: {
              ...CORS_HEADERS,
              "Content-Type": "application/json"
            }
          });
        }

        const report = await runSelfMaintenance(env);
        logger.log("manual_self_maintenance_complete", report);

        return new Response(JSON.stringify({ ok: true, report }), {
          headers: {
            ...CORS_HEADERS,
            "Content-Type": "application/json"
          }
        });
      }

      if (url.pathname === "/internal/mind" && request.method === "POST") {
        if (!isAdminAuthorized(request, env)) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: {
              ...CORS_HEADERS,
              "Content-Type": "application/json"
            }
          });
        }

        const body = (await request.json().catch(() => ({}))) as InternalMindRequestBody;
        const mode = resolveInternalMindMode(String(body?.mode || ""));
        if (!mode) {
          return new Response(
            JSON.stringify({
              error: "Invalid mode. Expected one of: improvement, patch, tasks."
            }),
            {
              status: 400,
              headers: {
                ...CORS_HEADERS,
                "Content-Type": "application/json"
              }
            }
          );
        }

        const payload =
          mode === "improvement"
            ? buildInternalMindImprovementResponse(body)
            : mode === "patch"
              ? buildInternalMindPatchResponse(body)
              : buildInternalMindTasksResponse(body);

        return new Response(JSON.stringify(payload), {
          headers: {
            ...CORS_HEADERS,
            "Content-Type": "application/json"
          }
        });
      }

      if (url.pathname === "/api/video/generate" && request.method === "POST") {
        const body = (await request.json().catch(() => ({}))) as VideoGenerateRequestBody;
        const prompt = sanitizePromptText(String(body?.prompt || "")).trim();
        const safetyProfile = normalizeSafetyProfile(body?.safetyProfile);

        if (!prompt) {
          return new Response(JSON.stringify({ error: "Prompt is required" }), {
            status: 400,
            headers: {
              ...CORS_HEADERS,
              "Content-Type": "application/json"
            }
          });
        }

        const safetyDecision = evaluateSexualSafetyPrompt(prompt, safetyProfile);
        if (safetyDecision.blocked) {
          return new Response(
            JSON.stringify({
              error: "Illegal sexual content is blocked for all access tiers.",
              code: safetyDecision.reason
            }),
            {
              status: 403,
              headers: {
                ...CORS_HEADERS,
                "Content-Type": "application/json"
              }
            }
          );
        }

        const durationRequested = clamp(Number(body?.durationSeconds || 4), 2, 8);
        const widthRequested = clamp(Number(body?.width || 512), 256, 768);
        const heightRequested = clamp(Number(body?.height || 512), 256, 768);
        const fpsRequested = clamp(Number(body?.fps || 12), 8, 24);

        const jobId = `job-${crypto.randomUUID()}`;
        const job: OmniVideoJob = {
          id: jobId,
          status: "queued",
          prompt,
          durationSeconds: durationRequested,
          width: widthRequested,
          height: heightRequested,
          fps: fpsRequested,
          createdAt: new Date().toISOString()
        };

        await saveVideoJob(env, job);
        void processVideoJob(env, logger, jobId, {
          ...body,
          prompt,
          maxSizeMB: Number(body?.maxSizeMB || 2)
        });

        return new Response(JSON.stringify(job), {
          status: 202,
          headers: {
            ...CORS_HEADERS,
            "Content-Type": "application/json"
          }
        });
      }

      if (url.pathname.startsWith("/api/video/job/") && request.method === "GET") {
        const jobId = sanitizePromptText(url.pathname.slice("/api/video/job/".length)).trim();
        if (!jobId) {
          return new Response(JSON.stringify({ error: "Job id is required" }), {
            status: 400,
            headers: {
              ...CORS_HEADERS,
              "Content-Type": "application/json"
            }
          });
        }

        const job = await readVideoJob(env, jobId);
        if (!job) {
          return new Response(JSON.stringify({ error: "Video job not found" }), {
            status: 404,
            headers: {
              ...CORS_HEADERS,
              "Content-Type": "application/json"
            }
          });
        }

        return new Response(JSON.stringify(job), {
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

      if (url.pathname === "/api/video/generate" && request.method !== "POST") {
        return new Response("Method Not Allowed", {
          status: 405,
          headers: {
            ...CORS_HEADERS,
            "Allow": "POST, OPTIONS"
          }
        });
      }

      if (url.pathname.startsWith("/api/video/job/") && request.method !== "GET") {
        return new Response("Method Not Allowed", {
          status: 405,
          headers: {
            ...CORS_HEADERS,
            "Allow": "GET, OPTIONS"
          }
        });
      }

      if (url.pathname === "/api/video/phase1" && request.method !== "POST") {
        return new Response("Method Not Allowed", {
          status: 405,
          headers: {
            ...CORS_HEADERS,
            "Allow": "POST, OPTIONS"
          }
        });
      }

      if (url.pathname === "/internal/mind" && request.method !== "POST") {
        return new Response("Method Not Allowed", {
          status: 405,
          headers: {
            ...CORS_HEADERS,
            "Allow": "POST, OPTIONS"
          }
        });
      }

      if (url.pathname === "/api/laws" && request.method !== "GET") {
        return new Response("Method Not Allowed", {
          status: 405,
          headers: {
            ...CORS_HEADERS,
            "Allow": "GET, OPTIONS"
          }
        });
      }

      if (url.pathname === "/api/internet/search" && request.method !== "GET") {
        return new Response("Method Not Allowed", {
          status: 405,
          headers: {
            ...CORS_HEADERS,
            "Allow": "GET, OPTIONS"
          }
        });
      }

      if (url.pathname === "/api/internet/learning" && request.method !== "GET") {
        return new Response("Method Not Allowed", {
          status: 405,
          headers: {
            ...CORS_HEADERS,
            "Allow": "GET, OPTIONS"
          }
        });
      }

      if (url.pathname === "/api/internet/weather" && request.method !== "GET") {
        return new Response("Method Not Allowed", {
          status: 405,
          headers: {
            ...CORS_HEADERS,
            "Allow": "GET, OPTIONS"
          }
        });
      }

      if (url.pathname === "/api/internet/inspect" && request.method !== "GET") {
        return new Response("Method Not Allowed", {
          status: 405,
          headers: {
            ...CORS_HEADERS,
            "Allow": "GET, OPTIONS"
          }
        });
      }

      if (url.pathname === "/api/human-verify/config" && request.method !== "GET") {
        return new Response("Method Not Allowed", {
          status: 405,
          headers: {
            ...CORS_HEADERS,
            "Allow": "GET, OPTIONS"
          }
        });
      }

      if (url.pathname === "/api/human-verify/challenge" && request.method !== "GET") {
        return new Response("Method Not Allowed", {
          status: 405,
          headers: {
            ...CORS_HEADERS,
            "Allow": "GET, OPTIONS"
          }
        });
      }

      if (url.pathname === "/api/human-verify" && request.method !== "POST") {
        return new Response("Method Not Allowed", {
          status: 405,
          headers: {
            ...CORS_HEADERS,
            "Allow": "POST, OPTIONS"
          }
        });
      }

      if (url.pathname === "/api/maintenance/status" && request.method !== "GET") {
        return new Response("Method Not Allowed", {
          status: 405,
          headers: {
            ...CORS_HEADERS,
            "Allow": "GET, OPTIONS"
          }
        });
      }

      if (url.pathname === "/api/maintenance/run" && request.method !== "POST") {
        return new Response("Method Not Allowed", {
          status: 405,
          headers: {
            ...CORS_HEADERS,
            "Allow": "POST, OPTIONS"
          }
        });
      }

      if (url.pathname === "/api/release/spec" && request.method !== "GET") {
        return new Response("Method Not Allowed", {
          status: 405,
          headers: {
            ...CORS_HEADERS,
            "Allow": "GET, OPTIONS"
          }
        });
      }

      if (url.pathname === "/api/video/phase1" && request.method === "POST") {
        try {
          const body = (await request.json()) as VideoPhase1RequestBody;
          const safetyProfile = normalizeSafetyProfile(body?.safetyProfile);
          const prompt = sanitizePromptText(String(body?.prompt || ""));

          if (!prompt) {
            return new Response(JSON.stringify({ error: "Prompt is required" }), {
              status: 400,
              headers: {
                ...CORS_HEADERS,
                "Content-Type": "application/json"
              }
            });
          }

          const safetyDecision = evaluateSexualSafetyPrompt(prompt, safetyProfile);
          if (safetyDecision.blocked) {
            return new Response(
              JSON.stringify({
                error:
                  safetyDecision.reason === "illegal-content-blocked"
                    ? "Illegal sexual content is blocked for all access tiers."
                    : "Explicit sexual content is age-restricted and unavailable for this profile.",
                code: safetyDecision.reason
              }),
              {
                status: 403,
                headers: {
                  ...CORS_HEADERS,
                  "Content-Type": "application/json"
                }
              }
            );
          }

          const payload = await runPhase1VideoGeneration(env, prompt, body);
          const responsePayload = {
            ok: true,
            result: payload.result,
            previews: payload.previews,
            createdAt: payload.createdAt
          };

          return new Response(JSON.stringify(responsePayload), {
            headers: {
              ...CORS_HEADERS,
              "Content-Type": "application/json"
            }
          });
        } catch (videoErr: any) {
          logger.error("video_phase1_error", videoErr);
          return new Response(JSON.stringify({ error: "Video Phase 1 generation failed" }), {
            status: 500,
            headers: {
              ...CORS_HEADERS,
              "Content-Type": "application/json"
            }
          });
        }
      }

      if (url.pathname === "/api/image" && request.method === "POST") {
        try {
          const body = (await request.json()) as ImageRequestBody;
          const safetyProfile = normalizeSafetyProfile(body?.safetyProfile);
          const userId = sanitizePromptText(String(body?.userId || "anonymous"));
          const promptText = sanitizePromptText(String(body?.prompt || ""));
          const feedback = sanitizePromptText(String(body?.feedback || ""));
          const requestedStylePack = sanitizePromptText(String(body?.stylePack || "")).toLowerCase();
          const requestedLaws = Array.isArray(body?.laws)
            ? body.laws
                .map((law) => {
                  const id = sanitizePromptText(String(law?.id || "")).toUpperCase();
                  const mode = sanitizePromptText(String(law?.mode || "")).toLowerCase();
                  const weight = Number(law?.weight);
                  const normalizedMode: LawReference["mode"] =
                    mode === "symbolic" || mode === "structural" || mode === "color" || mode === "motion"
                      ? mode
                      : undefined;
                  return {
                    id,
                    mode: normalizedMode,
                    weight: Number.isFinite(weight) ? Math.min(1, Math.max(0, weight)) : undefined
                  };
                })
                .filter((law) => Boolean(law.id))
            : [];
          const requestedQuality = sanitizePromptText(String(body?.quality || "ultra")).toLowerCase() || "ultra";
          const requestedMode = sanitizePromptText(String(body?.mode || "simple")).toLowerCase() || "simple";
          const promptInferredStyle = resolveStyleName(inferStyleFromPrompt(promptText));
          const promptInferredCamera = inferCameraFromPrompt(promptText);
          const promptInferredLighting = inferLightingFromPrompt(promptText);
          const promptInferredMaterials = inferMaterialsFromPrompt(promptText);
          const effectiveStylePack = promptInferredStyle || requestedStylePack;
          const resolvedRenderingStyle = resolveStyleName(effectiveStylePack) || "auto";
          const requestedCameraRaw = sanitizePromptText(String(body?.camera || "")).toLowerCase();
          const requestedLightingRaw = sanitizePromptText(String(body?.lighting || "")).toLowerCase();
          const requestedMaterials = Array.isArray(body?.materials)
            ? body.materials.map((item) => sanitizePromptText(String(item || "")).toLowerCase()).filter(Boolean)
            : [];
          const effectiveCamera = promptInferredCamera || requestedCameraRaw || "portrait-85mm";
          const effectiveLighting = promptInferredLighting || requestedLightingRaw || "studio-soft";
          const effectiveMaterials = promptInferredMaterials.length
            ? promptInferredMaterials
            : requestedMaterials.length
              ? requestedMaterials
              : resolvedRenderingStyle === "hyper-real"
                ? ["skin"]
                : [];
          const requestedRatio = sanitizePromptText(String(body?.ratio || "1:1")) || "1:1";
          const requestedResolution = sanitizePromptText(String(body?.resolution || ""));
          const requestedWidth = Number(body?.width);
          const requestedHeight = Number(body?.height);
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

          const safetyDecision = evaluateSexualSafetyPrompt(promptText, safetyProfile);
          if (safetyDecision.blocked) {
            return new Response(
              JSON.stringify({
                error:
                  safetyDecision.reason === "illegal-content-blocked"
                    ? "Illegal sexual content is blocked for all access tiers."
                    : "Explicit sexual content is age-restricted and unavailable for this profile.",
                code: safetyDecision.reason
              }),
              {
                status: 403,
                headers: {
                  ...CORS_HEADERS,
                  "Content-Type": "application/json"
                }
              }
            );
          }

          const orchestrated = orchestrateOmniImagePrompt(promptText, {
            mode: requestedMode,
            stylePack: effectiveStylePack,
            laws: requestedLaws,
            quality: requestedQuality,
            feedback,
            seed: Number.isFinite(parsedSeed) ? parsedSeed : undefined,
            camera: effectiveCamera,
            lighting: effectiveLighting,
            materials: effectiveMaterials
          });

          const refined = refineOmniImagePrompt(orchestrated, {
            mode: requestedMode,
            stylePack: effectiveStylePack,
            laws: requestedLaws,
            quality: requestedQuality,
            feedback,
            seed: Number.isFinite(parsedSeed) ? parsedSeed : undefined,
            camera: effectiveCamera,
            lighting: effectiveLighting,
            materials: effectiveMaterials
          });

          const modelConfig = selectImageModelConfig(
            effectiveStylePack,
            requestedQuality,
            env,
            requestedRatio,
            requestedResolution,
            requestedWidth,
            requestedHeight
          );

          let fallbackUsed = false;
          let fallbackReason: string | null = null;

          const primaryPrompt = refined.data.finalPrompt;
          const compactPrompt = [
            orchestrated.userPrompt,
            ...refined.data.styleTags.slice(0, 6),
            ...refined.data.technicalTags.slice(0, 8)
          ]
            .filter(Boolean)
            .join(", ")
            .slice(0, 900);

          let rawImage: any;
          try {
            rawImage = await env.AI.run(modelConfig.model, {
              prompt: primaryPrompt,
              width: modelConfig.width,
              height: modelConfig.height,
              seed: refined.finalOptions.seed
            });
          } catch (primaryErr: any) {
            const normalizedPrimaryError = normalizeImageGenerationError(primaryErr);
            const shouldRetryCompactPrompt =
              normalizedPrimaryError.code === "prompt-too-long" ||
              normalizedPrimaryError.code === "provider-timeout" ||
              normalizedPrimaryError.code === "provider-unavailable";

            if (!shouldRetryCompactPrompt || !compactPrompt) {
              throw primaryErr;
            }

            fallbackUsed = true;
            fallbackReason = normalizedPrimaryError.code;
            rawImage = await env.AI.run(modelConfig.model, {
              prompt: compactPrompt,
              width: modelConfig.width,
              height: modelConfig.height,
              seed: refined.finalOptions.seed
            });
          }

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
              ratio: modelConfig.ratio,
              resolution: modelConfig.resolution,
              mode: requestedMode,
              quality: requestedQuality,
              rendering_style: resolvedRenderingStyle,
              rendering_style_source: promptInferredStyle ? "prompt" : (requestedStylePack ? "session-or-request" : "auto"),
              camera: effectiveCamera,
              camera_source: promptInferredCamera ? "prompt" : (requestedCameraRaw ? "session-or-request" : "default"),
              lighting: effectiveLighting,
              lighting_source: promptInferredLighting ? "prompt" : (requestedLightingRaw ? "session-or-request" : "default"),
              materials: effectiveMaterials,
              materials_source: promptInferredMaterials.length ? "prompt" : (requestedMaterials.length ? "session-or-request" : (resolvedRenderingStyle === "hyper-real" ? "hyper-real-default" : "default")),
              seed: refined.finalOptions.seed,
              feedbackApplied: Boolean(feedback),
              prompt: {
                userPrompt: orchestrated.userPrompt,
                semanticExpansion: orchestrated.semanticExpansion,
                lawTags: refined.data.lawTags,
                lawInfluence: refined.data.lawInfluence,
                technicalTags: refined.data.technicalTags,
                styleTags: refined.data.styleTags,
                negativeTags: refined.data.negativeTags,
                finalPrompt: refined.data.finalPrompt,
                fallbackUsed,
                fallbackReason
              },
              safety: {
                ageTier: safetyProfile.ageTier,
                explicitAllowed: safetyProfile.explicitAllowed,
                illegalBlocked: safetyProfile.illegalBlocked
              },
              export_location: "chat-download"
            }
          };

          if (debugRequested) {
            responsePayload.debug = {
              requested: {
                mode: requestedMode,
                stylePack: requestedStylePack,
                inferredStyleFromPrompt: promptInferredStyle || null,
                effectiveStylePack: effectiveStylePack || null,
                quality: requestedQuality,
                renderingStyle: resolvedRenderingStyle,
                inferredCameraFromPrompt: promptInferredCamera || null,
                effectiveCamera: effectiveCamera,
                inferredLightingFromPrompt: promptInferredLighting || null,
                effectiveLighting: effectiveLighting,
                inferredMaterialsFromPrompt: promptInferredMaterials,
                effectiveMaterials: effectiveMaterials,
                availableStyles: listAvailableStyles(),
                ratio: requestedRatio,
                resolution: requestedResolution || null,
                width: Number.isFinite(requestedWidth) ? requestedWidth : null,
                height: Number.isFinite(requestedHeight) ? requestedHeight : null,
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
          const normalizedError = normalizeImageGenerationError(imageErr);
          return new Response(JSON.stringify({
            error: normalizedError.message,
            code: normalizedError.code,
            details: normalizedError.details
          }), {
            status: normalizedError.status,
            headers: {
              ...CORS_HEADERS,
              "Content-Type": "application/json"
            }
          });
        }
      }

      if (url.pathname === "/api/omni" && request.method === "POST") {
        await ensureOmniMemorySchema(env);
        const body = (await request.json()) as OmniRequestBody;
        const safetyProfile = normalizeSafetyProfile(body?.safetyProfile);

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

        const simulationContext = normalizedMode === "simulation"
          ? await advanceSimulationState(env, ctx.messages)
          : null;
        const sessionId = resolveSessionId(request);
        const workingMemory = await loadWorkingMemory(env, sessionId);

        const latestUserText = getLatestUserText(ctx.messages);
        const safetyDecision = evaluateSexualSafetyPrompt(latestUserText, safetyProfile);
        if (safetyDecision.blocked) {
          return new Response(
            JSON.stringify({
              error:
                safetyDecision.reason === "illegal-content-blocked"
                  ? "Illegal sexual content is blocked for all users."
                  : "Explicit sexual content is age-restricted for this profile.",
              code: safetyDecision.reason
            }),
            {
              status: 403,
              headers: {
                ...CORS_HEADERS,
                "Content-Type": "application/json"
              }
            }
          );
        }

        const personaProfile = await resolvePersonaProfile(env, normalizedMode);
        const emotionalResonance = await getEmotionalResonance(
          env,
          sessionId,
          latestUserText,
          workingMemory.emotionalTone
        );
        const orchestratorDecision = decideMultimodalRoute({
          latestUserText,
          mode: normalizedMode
        });
        const routeSelection = chooseModelForTask(ctx.model, latestUserText, normalizedMode);

        const promptSystemMessages: OmniMessage[] = [];
        let internetProfileUsed: InternetSearchProfile | null = null;
        let internetHitCount = 0;
        const savedMemory = normalizedMode === "simulation" ? {} : await getPreferences(env);
        if (normalizedMode !== "simulation" && savedMemory && Object.keys(savedMemory).length > 0) {
          promptSystemMessages.push(
            makeContextSystemMessage("User Memory", JSON.stringify(savedMemory, null, 2))
          );
        }

        if (simulationContext) {
          promptSystemMessages.push(
            makeContextSystemMessage("Simulation Engine", simulationContext.systemPrompt)
          );
          promptSystemMessages.push(
            makeContextSystemMessage("Simulation Log", simulationContext.logsSummary)
          );
        }

        promptSystemMessages.push(
          makeContextSystemMessage("Persona Engine", buildPersonaPrompt(personaProfile))
        );
        promptSystemMessages.push(
          makeContextSystemMessage(
            "Safety Profile",
            JSON.stringify(
              {
                ageTier: safetyProfile.ageTier,
                explicitAllowed: safetyProfile.explicitAllowed,
                illegalBlocked: safetyProfile.illegalBlocked,
                enforcement: "illegal content is always blocked"
              },
              null,
              2
            )
          )
        );
        promptSystemMessages.push(
          makeContextSystemMessage("Emotional Resonance", buildEmotionalResonancePrompt(emotionalResonance))
        );
        promptSystemMessages.push(
          makeContextSystemMessage(
            "Adaptive Behavior",
            buildAdaptiveBehaviorPrompt({
              mode: normalizedMode,
              userEmotion: emotionalResonance.userEmotion,
              omniTone: emotionalResonance.omniTone,
              route: orchestratorDecision.route
            })
          )
        );

        if (normalizedMode !== "simulation") {
          const workingMemoryPrompt = formatWorkingMemoryPrompt(workingMemory);
          if (workingMemoryPrompt) {
            promptSystemMessages.push(
              makeContextSystemMessage("Working Memory", workingMemoryPrompt)
            );
          }

          const memoryArc = await getRecentMemoryArc(env, sessionId, 3);
          if (memoryArc.length) {
            const arcPrompt = memoryArc
              .map((entry, index) => {
                return `(${index + 1}) [${entry.mode}] USER: ${entry.userText}\nOMNI: ${entry.assistantText}`;
              })
              .join("\n\n");

            promptSystemMessages.push(
              makeContextSystemMessage("Long-Term Memory Arc", arcPrompt)
            );
          }
        }

        const modeTemplate = buildModeTemplate({
          mode: normalizedMode,
          latestUserText
        });

        if (modeTemplate) {
          promptSystemMessages.push(makeContextSystemMessage("Mode Template", modeTemplate));
        }

        const internetLearningContext = await getInternetLearningContext(env, normalizedMode, latestUserText, 4);
        if (internetLearningContext) {
          promptSystemMessages.push(
            makeContextSystemMessage(
              "Internet Learning Memory",
              [
                "The following learned internet findings were collected from prior searches.",
                "Use them as supplemental context and prefer fresher direct retrieval when conflicts appear.",
                "",
                internetLearningContext
              ].join("\n")
            )
          );
        }

        if (shouldUseWeatherContext(latestUserText)) {
          const weatherLocation = inferWeatherLocation(latestUserText, request);
          const weather = await fetchWeatherForLocation(weatherLocation);
          if (weather) {
            promptSystemMessages.push(
              makeContextSystemMessage(
                "Live Weather",
                [
                  `Location: ${weather.location}`,
                  `Temperature (C): ${weather.temperatureC}`,
                  `Wind (km/h): ${weather.windSpeedKmh}`,
                  `Weather code: ${weather.weatherCode}`,
                  `Observation time: ${weather.observationTime}`,
                  `Timezone: ${weather.timezone}`,
                  "Use this weather context for current-condition questions and be explicit that it is a point-in-time snapshot."
                ].join("\n")
              )
            );
          }
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

        if (shouldUseInternetSearch(latestUserText, normalizedMode)) {
          const internet = await performModeAwareInternetSearch(normalizedMode, latestUserText);
          await recordInternetLearning(env, normalizedMode, latestUserText, internet.hits);
          internetProfileUsed = internet.profile;
          internetHitCount = internet.hits.length;
          if (internet.hits.length) {
            const internetContext = internet.hits
              .map((hit, index) => {
                return `(${index + 1}) [${hit.source}] ${hit.title}\n${hit.snippet}\nURL: ${hit.url}`;
              })
              .join("\n\n---\n\n");

            promptSystemMessages.push(
              makeContextSystemMessage(
                "Internet Retrieval",
                [
                  `Mode profile: prefix='${internet.profile.queryPrefix}', suffix='${internet.profile.querySuffix}', limit=${internet.profile.limit}`,
                  "Use these internet references when relevant, and do not fabricate facts beyond cited context.",
                  "",
                  internetContext
                ].join("\n")
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
          orchestratorRoute: orchestratorDecision.route,
          orchestratorReason: orchestratorDecision.reason,
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

        try {
          let multimodalPayload: Record<string, unknown> | null = null;
          let result: any;

          if (orchestratorDecision.route === "tool" && orchestratorDecision.toolDirective) {
            const toolResult = await executeTool(
              orchestratorDecision.toolDirective.name,
              orchestratorDecision.toolDirective.input
            );
            result = {
              response: toolResult.success
                ? `Tool '${toolResult.tool}' executed successfully. Output: ${JSON.stringify(toolResult.output)}`
                : `Tool '${toolResult.tool}' failed: ${toolResult.error || "unknown error"}`
            };
          } else if (orchestratorDecision.route === "memory") {
            result = {
              response: [
                "Memory snapshot:",
                formatWorkingMemoryPrompt(workingMemory),
                savedMemory && Object.keys(savedMemory).length
                  ? `Preferences: ${JSON.stringify(savedMemory)}`
                  : "Preferences: none"
              ]
                .filter(Boolean)
                .join("\n\n")
            };
          } else if (orchestratorDecision.route === "image") {
            const generated = await generateOmniImageFromPrompt(env, latestUserText, {
              mode: normalizedMode,
              quality: "ultra"
            });

            multimodalPayload = {
              imageDataUrl: generated.imageDataUrl,
              image: {
                filename: generated.filename,
                model: generated.model,
                metadata: generated.metadata
              }
            };

            result = {
              response: `Image generated via multi-modal orchestration. File: ${generated.filename}. Model: ${generated.model}.`
            };
          } else {
            result = await omniBrainLoop(env, runtimeCtx);
          }

          if (result) {
            const parsedResult =
              typeof result === "string"
                ? { response: result }
                : result;
            const safe = OmniSafety.safeGuardResponse(parsedResult.response || "", responseLimit);
            const adapted = applyAdaptiveBehavior(safe, {
              mode: normalizedMode,
              userEmotion: emotionalResonance.userEmotion,
              omniTone: emotionalResonance.omniTone,
              route: orchestratorDecision.route
            });
            const finalResponse = OmniSafety.safeGuardResponse(adapted, responseLimit);
            const encoder = new TextEncoder();
            const stream = new ReadableStream({
              start(controller) {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ content: finalResponse, route: orchestratorDecision.route, ...multimodalPayload })}\n\n`
                  )
                );
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                controller.close();
              }
            });

            const latestUserTurn = getLatestUserText(ctx.messages);
            if (normalizedMode !== "simulation" && latestUserTurn && finalResponse) {
              await persistEmotionalResonance(env, emotionalResonance);

              await updateWorkingMemoryFromTurn(env, {
                sessionId,
                mode: normalizedMode,
                userText: latestUserTurn,
                assistantText: finalResponse,
                emotionalTone: emotionalResonance.omniTone
              });

              await saveMemoryTurn(env, {
                sessionId,
                mode: normalizedMode,
                userText: latestUserTurn,
                assistantText: finalResponse,
                emotionalTone: emotionalResonance.omniTone
              });
            }

            const exposeHeaders = [
              "X-Omni-Model-Used",
              "X-Omni-Route-Reason",
              "X-Omni-Orchestrator-Route",
              "X-Omni-Orchestrator-Reason",
              "X-Omni-Persona-Tone",
              "X-Omni-Emotion-User",
              "X-Omni-Emotion-Omni",
              "X-Omni-Internet-Mode",
              "X-Omni-Internet-Profile",
              "X-Omni-Internet-Count"
            ];

            if (simulationContext) {
              exposeHeaders.push("X-Omni-Simulation-Id", "X-Omni-Simulation-Status", "X-Omni-Simulation-Steps");
            }

            if (debugEnabled) {
              exposeHeaders.push("X-Omni-Response-Cap", "X-Omni-Output-Token-Cap");
            }

            return new Response(stream, {
              headers: {
                ...CORS_HEADERS,
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Omni-Model-Used": String(runtimeCtx.model || routeSelection.selectedModel),
                "X-Omni-Route-Reason": routeSelection.reason,
                "X-Omni-Orchestrator-Route": orchestratorDecision.route,
                "X-Omni-Orchestrator-Reason": orchestratorDecision.reason,
                "X-Omni-Persona-Tone": personaProfile.tone,
                "X-Omni-Emotion-User": emotionalResonance.userEmotion,
                "X-Omni-Emotion-Omni": emotionalResonance.omniTone,
                "X-Omni-Internet-Mode": normalizeInternetMode(normalizedMode),
                "X-Omni-Internet-Profile": internetProfileUsed
                  ? `${internetProfileUsed.queryPrefix}|${internetProfileUsed.querySuffix}|${internetProfileUsed.limit}`
                  : "none",
                "X-Omni-Internet-Count": String(internetHitCount),
                ...(simulationContext
                  ? {
                      "X-Omni-Simulation-Id": simulationContext.state.simulationId,
                      "X-Omni-Simulation-Status": simulationContext.state.status,
                      "X-Omni-Simulation-Steps": String(simulationContext.state.stepsExecuted)
                    }
                  : {}),
                ...(debugEnabled
                  ? {
                      "X-Omni-Response-Cap": String(responseLimit),
                      "X-Omni-Output-Token-Cap": String(outputTokenLimit)
                    }
                  : {}),
                "Access-Control-Expose-Headers": exposeHeaders.join(", ")
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
            ...(simulationContext
              ? {
                  "X-Omni-Simulation-Id": simulationContext.state.simulationId,
                  "X-Omni-Simulation-Status": simulationContext.state.status,
                  "X-Omni-Simulation-Steps": String(simulationContext.state.stepsExecuted)
                }
              : {}),
            ...(debugEnabled
              ? {
                  "X-Omni-Response-Cap": String(responseLimit),
                  "X-Omni-Output-Token-Cap": String(outputTokenLimit),
                "Access-Control-Expose-Headers": simulationContext
                  ? "X-Omni-Model-Used, X-Omni-Route-Reason, X-Omni-Simulation-Id, X-Omni-Simulation-Status, X-Omni-Simulation-Steps, X-Omni-Response-Cap, X-Omni-Output-Token-Cap"
                  : "X-Omni-Model-Used, X-Omni-Route-Reason, X-Omni-Response-Cap, X-Omni-Output-Token-Cap"
                }
              : {
                  "Access-Control-Expose-Headers": simulationContext
                    ? "X-Omni-Model-Used, X-Omni-Route-Reason, X-Omni-Simulation-Id, X-Omni-Simulation-Status, X-Omni-Simulation-Steps"
                    : "X-Omni-Model-Used, X-Omni-Route-Reason"
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
  },

  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    const logger = new OmniLogger(env);
    ctx.waitUntil(
      (async () => {
        const report = await runSelfMaintenance(env);
        logger.log("self_maintenance_complete", {
          cron: controller.cron,
          scheduledTime: controller.scheduledTime,
          ...report
        });
      })().catch((err) => {
        logger.error("self_maintenance_failed", err);
      })
    );
  }
};

type InternalMindMode = "improvement" | "patch" | "tasks";

type InternalMindPatchContextFile = {
  path?: string;
  content?: string;
};

type InternalMindEvaluationInput = {
  sessionId?: string;
  score?: number;
  qualityScore?: number;
  latencyScore?: number;
  reliabilityScore?: number;
  safetyScore?: number;
  issues?: string[];
  findings?: string[];
  rawLog?: unknown;
};

type InternalMindRequestBody = {
  mode?: string;
  evaluation?: InternalMindEvaluationInput;
  errorLog?: string;
  context?: {
    files?: InternalMindPatchContextFile[];
  };
  issues?: string[];
  codexGaps?: string[];
};
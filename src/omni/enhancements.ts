import type { Fetcher, KVNamespace } from "@cloudflare/workers-types";

type WorkerEnv = {
  ASSETS?: Fetcher;
  MEMORY?: KVNamespace;
  MODEL_OMNI?: string;
  MODEL_GPT_4O?: string;
  MODEL_DEEPSEEK?: string;
};

export interface IndexedDocument {
  id: string;
  source: string;
  title: string;
  text: string;
}

export interface SearchHit {
  score: number;
  chunk: string;
  source: string;
  title: string;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const docCache = new Map<string, { ts: number; docs: IndexedDocument[] }>();
const MEMORY_KEY = "omni:preferences";

function normalizeText(value: unknown): string {
  return String(value || "").trim();
}

function tokenize(input: string): string[] {
  return normalizeText(input)
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 3);
}

async function fetchAssetText(env: WorkerEnv, request: Request, path: string): Promise<string> {
  if (!env.ASSETS?.fetch) return "";

  const assetUrl = new URL(path, request.url);
  const assetRes = await env.ASSETS.fetch(assetUrl.toString());
  if (!assetRes.ok) {
    return "";
  }

  return await assetRes.text();
}

async function readManifest(env: WorkerEnv, request: Request, basePath: string): Promise<string[]> {
  const raw = await fetchAssetText(env, request, `${basePath}/manifest.json`);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed?.files)) {
      return parsed.files
        .map((f: unknown) => normalizeText(f))
        .filter(Boolean);
    }
  } catch {
    return [];
  }

  return [];
}

async function loadDocumentSet(env: WorkerEnv, request: Request, basePath: string): Promise<IndexedDocument[]> {
  const cacheKey = `${basePath}`;
  const now = Date.now();
  const cached = docCache.get(cacheKey);

  if (cached && now - cached.ts <= CACHE_TTL_MS) {
    return cached.docs;
  }

  const files = await readManifest(env, request, basePath);
  const docs: IndexedDocument[] = [];

  for (const file of files) {
    const text = await fetchAssetText(env, request, `${basePath}/${file}`);
    if (!text) continue;

    const cleanText = text.trim();
    if (!cleanText) continue;

    docs.push({
      id: `${basePath}:${file}`,
      source: `${basePath}/${file}`,
      title: file,
      text: cleanText
    });
  }

  docCache.set(cacheKey, { ts: now, docs });
  return docs;
}

function chunkText(text: string, targetChars = 650): string[] {
  const clean = normalizeText(text);
  if (!clean) return [];

  const paragraphs = clean.split(/\n{2,}/).map((part) => normalizeText(part)).filter(Boolean);
  if (!paragraphs.length) return [clean];

  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    if (!current) {
      current = paragraph;
      continue;
    }

    if ((current.length + paragraph.length + 2) <= targetChars) {
      current += `\n\n${paragraph}`;
      continue;
    }

    chunks.push(current);
    current = paragraph;
  }

  if (current) chunks.push(current);
  return chunks;
}

function scoreChunk(queryTokens: string[], chunk: string): number {
  if (!queryTokens.length || !chunk) return 0;

  const lower = chunk.toLowerCase();
  let score = 0;
  for (const token of queryTokens) {
    const exactRegex = new RegExp(`\\b${token}\\b`, "g");
    const exact = lower.match(exactRegex)?.length || 0;
    if (exact > 0) {
      score += exact * 6;
      continue;
    }

    if (lower.includes(token)) {
      score += 2;
    }
  }

  return score;
}

export async function searchKnowledge(env: WorkerEnv, request: Request, query: string, limit = 4): Promise<SearchHit[]> {
  const docs = await loadDocumentSet(env, request, "/knowledge");
  return searchDocs(docs, query, limit);
}

export async function searchModules(env: WorkerEnv, request: Request, query: string, limit = 3): Promise<SearchHit[]> {
  const docs = await loadDocumentSet(env, request, "/modules");
  return searchDocs(docs, query, limit);
}

function searchDocs(docs: IndexedDocument[], query: string, limit: number): SearchHit[] {
  const tokens = tokenize(query);
  if (!tokens.length) return [];

  const hits: SearchHit[] = [];

  for (const doc of docs) {
    const chunks = chunkText(doc.text);
    for (const chunk of chunks) {
      const score = scoreChunk(tokens, chunk);
      if (score <= 0) continue;
      hits.push({
        score,
        chunk,
        source: doc.source,
        title: doc.title
      });
    }
  }

  return hits.sort((a, b) => b.score - a.score).slice(0, Math.max(1, Math.min(10, limit)));
}

export function shouldUseKnowledgeRetrieval(input: string, mode: string): boolean {
  const normalizedMode = normalizeText(mode).toLowerCase();
  if (normalizedMode === "knowledge") return true;

  const text = normalizeText(input).toLowerCase();
  if (!text) return false;

  return /\b(what is|who is|when did|where is|fact|facts|docs|document|policy|reference|manual|spec|api)\b/i.test(text);
}

export function shouldUseSystemKnowledge(mode: string): boolean {
  return normalizeText(mode).toLowerCase() === "system-knowledge";
}

export interface PromptTemplateOptions {
  mode: string;
  latestUserText: string;
}

export function buildModeTemplate(options: PromptTemplateOptions): string {
  const mode = normalizeText(options.mode).toLowerCase();

  if (mode === "reasoning") {
    return [
      "Reasoning Mode is active.",
      "Think step-by-step internally before responding.",
      "Do not reveal chain-of-thought.",
      "Output only the final answer in clear, direct language."
    ].join("\n");
  }

  if (mode === "coding") {
    return [
      "Coding Mode is active.",
      "Explain your logic briefly first, then provide clean and tested code.",
      "Always format code in fenced triple-backtick blocks.",
      "Before finalizing, run a self-review and correct obvious issues in your own output."
    ].join("\n");
  }

  return "";
}

export type TaskType = "coding" | "math" | "creative" | "general";

export interface RouteSelection {
  selectedModel: string;
  taskType: TaskType;
  reason: string;
}

export function inferTaskType(latestUserText: string, mode: string): TaskType {
  const text = normalizeText(latestUserText).toLowerCase();
  const normalizedMode = normalizeText(mode).toLowerCase();

  if (normalizedMode === "coding" || /\b(code|typescript|javascript|python|bug|refactor|function|class|compile|syntax)\b/i.test(text)) {
    return "coding";
  }

  if (/\b(math|algebra|equation|integral|derivative|solve|proof|probability|statistics)\b/i.test(text)) {
    return "math";
  }

  if (/\b(story|poem|creative|brainstorm|narrative|lore|character|fiction)\b/i.test(text)) {
    return "creative";
  }

  return "general";
}

export function chooseModelForTask(requestedModel: string, latestUserText: string, mode: string): RouteSelection {
  const normalized = normalizeText(requestedModel).toLowerCase() || "auto";
  const taskType = inferTaskType(latestUserText, mode);

  if (normalized !== "auto") {
    return {
      selectedModel: normalized,
      taskType,
      reason: "manual-model-selection"
    };
  }

  if (taskType === "coding") {
    return { selectedModel: "gpt-4o", taskType, reason: "auto-route:coding" };
  }

  if (taskType === "math") {
    return { selectedModel: "deepseek", taskType, reason: "auto-route:math" };
  }

  if (taskType === "creative") {
    return { selectedModel: "omni", taskType, reason: "auto-route:creative" };
  }

  return { selectedModel: "omni", taskType, reason: "auto-route:general" };
}

export interface OmniPreferences {
  preferredMode?: string;
  writingStyle?: string;
  lastUsedSettings?: Record<string, string | boolean | number | null>;
}

export async function getPreferences(env: WorkerEnv): Promise<OmniPreferences> {
  if (!env.MEMORY?.get) return {};
  const data = await env.MEMORY.get(MEMORY_KEY, "json");
  if (!data || typeof data !== "object") return {};
  return data as OmniPreferences;
}

export async function savePreferences(env: WorkerEnv, payload: OmniPreferences): Promise<OmniPreferences> {
  const nextValue: OmniPreferences = {
    preferredMode: normalizeText(payload?.preferredMode),
    writingStyle: normalizeText(payload?.writingStyle),
    lastUsedSettings: payload?.lastUsedSettings && typeof payload.lastUsedSettings === "object"
      ? payload.lastUsedSettings
      : {}
  };

  if (env.MEMORY?.put) {
    await env.MEMORY.put(MEMORY_KEY, JSON.stringify(nextValue));
  }

  return nextValue;
}

export async function resetPreferences(env: WorkerEnv): Promise<void> {
  if (!env.MEMORY?.delete) return;
  await env.MEMORY.delete(MEMORY_KEY);
}

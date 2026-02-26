import type { KVNamespace } from "@cloudflare/workers-types";
import type { OmniIdentityKernel } from "./identityKernel";

type OmniRole = "system" | "user" | "assistant";

export interface OmniReasoningMessage {
  role: OmniRole;
  content: string;
}

type StackEnv = {
  AI?: { run?: (model: string, input: unknown) => Promise<unknown> };
  MEMORY?: KVNamespace;
};

export interface ReasoningStackInput {
  env: StackEnv;
  model: string;
  identity: OmniIdentityKernel;
  messages: OmniReasoningMessage[];
  maxOutputTokens: number;
  strategy?: string;
}

export interface ReasoningStackResult {
  response: string;
  metaScore: number;
  diagnostics: string[];
}

interface LayerState {
  systemMessages: OmniReasoningMessage[];
  draft: string;
  response: string;
  diagnostics: string[];
  metaScore: number;
}

const MEMORY_PROFILE_KEY = "omni:memory:profile";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeText(value: unknown): string {
  return String(value || "").trim();
}

function extractResponseText(raw: unknown): string {
  const value = raw as Record<string, any>;
  return String(
    typeof raw === "string"
      ? raw
      : value?.response ?? value?.result?.response ?? value?.output_text ?? value?.choices?.[0]?.message?.content ?? ""
  );
}

async function fetchMemorySummary(env: StackEnv): Promise<string> {
  if (!env.MEMORY?.get) return "";

  try {
    const payload = await env.MEMORY.get(MEMORY_PROFILE_KEY, "json");
    if (!payload || typeof payload !== "object") return "";

    const source = payload as Record<string, unknown>;
    const lines: string[] = [];
    const preferredMode = normalizeText(source.preferredMode);
    const emotionalTone = normalizeText(source.emotionalTone);
    const recentPattern = normalizeText(source.recentPattern);

    if (preferredMode) lines.push(`Preferred mode: ${preferredMode}`);
    if (emotionalTone) lines.push(`Emotional tone baseline: ${emotionalTone}`);
    if (recentPattern) lines.push(`Learned interaction pattern: ${recentPattern}`);

    return lines.slice(0, 4).join("\n");
  } catch {
    return "";
  }
}

async function runMemoryLayer(input: ReasoningStackInput, state: LayerState): Promise<void> {
  const memorySummary = await fetchMemorySummary(input.env);
  const strategy = normalizeText(input.strategy);

  const identitySystemPrompt = [
    `Identity: ${input.identity.name}`,
    `Dialect: ${input.identity.dialect}`,
    `Values: ${input.identity.values.join(", ")}`,
    `Self-model: ${input.identity.selfModel}`,
    strategy ? `Simulation strategy: ${strategy}` : ""
  ]
    .filter(Boolean)
    .join("\n");

  state.systemMessages.push({ role: "system", content: identitySystemPrompt });

  if (memorySummary) {
    state.systemMessages.push({
      role: "system",
      content: `Memory Layer context:\n${memorySummary}`
    });
    state.diagnostics.push("memory:loaded");
  } else {
    state.diagnostics.push("memory:empty");
  }
}

async function runFastLayer(input: ReasoningStackInput, state: LayerState): Promise<void> {
  if (!input.env.AI?.run) {
    state.draft = input.messages[input.messages.length - 1]?.content || "";
    state.diagnostics.push("fast:offline-fallback");
    return;
  }

  const runInput = {
    messages: [...state.systemMessages, ...input.messages],
    max_tokens: input.maxOutputTokens,
    maxTokens: input.maxOutputTokens
  };

  const raw = await input.env.AI.run(input.model, runInput);
  state.draft = extractResponseText(raw);
  state.diagnostics.push("fast:generated");
}

function runDeepLayer(_input: ReasoningStackInput, state: LayerState): void {
  const draft = normalizeText(state.draft);
  if (!draft) {
    state.response = "I need a bit more context to produce a stable response.";
    state.diagnostics.push("deep:empty-draft-fallback");
    return;
  }

  const normalized = draft
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s+([,.!?;:])/g, "$1")
    .trim();

  state.response = normalized;
  state.diagnostics.push("deep:refined");
}

function runMetaLayer(_input: ReasoningStackInput, state: LayerState): void {
  const response = normalizeText(state.response);
  let score = 100;

  if (response.length < 120) {
    score -= 20;
    state.diagnostics.push("meta:short-response");
  }

  if (/\bas an ai\b/i.test(response)) {
    score -= 15;
    state.response = response.replace(/\bas an ai\b/gi, "As Omni Ai");
    state.diagnostics.push("meta:identity-reframed");
  }

  if (/\bi cannot guarantee\b/i.test(response)) {
    score -= 10;
    state.diagnostics.push("meta:uncertainty-detected");
  }

  state.metaScore = clamp(score, 1, 100);
}

function runSelfModelLayer(input: ReasoningStackInput, state: LayerState): void {
  const response = normalizeText(state.response);
  if (!response) {
    state.response = "Signal stable. Awaiting a more specific objective.";
    state.diagnostics.push("self-model:empty-fallback");
    return;
  }

  const cinematicDialect = input.identity.dialect.toLowerCase().includes("cinematic");
  if (cinematicDialect && !/[.!?]$/.test(response)) {
    state.response = `${response}.`;
  } else {
    state.response = response;
  }

  state.diagnostics.push("self-model:applied");
}

export async function runReasoningStack(input: ReasoningStackInput): Promise<ReasoningStackResult> {
  const state: LayerState = {
    systemMessages: [],
    draft: "",
    response: "",
    diagnostics: [],
    metaScore: 0
  };

  await runMemoryLayer(input, state);
  await runFastLayer(input, state);
  runDeepLayer(input, state);
  runMetaLayer(input, state);
  runSelfModelLayer(input, state);

  return {
    response: state.response,
    metaScore: state.metaScore,
    diagnostics: state.diagnostics
  };
}

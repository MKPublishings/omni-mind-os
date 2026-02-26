import type { OmniIdentityKernel } from "./identityKernel";
import { runReasoningStack, type OmniReasoningMessage } from "./reasoningStack";
import type { KVNamespace } from "@cloudflare/workers-types";

type SimulationEnv = {
  AI?: { run?: (model: string, input: unknown) => Promise<unknown> };
  MEMORY?: KVNamespace;
  OMNI_SIMULATION_PATHS?: string;
};

export interface InternalSimulationInput {
  env: SimulationEnv;
  model: string;
  identity: OmniIdentityKernel;
  messages: OmniReasoningMessage[];
  maxOutputTokens: number;
}

export interface InternalSimulationResult {
  response: string;
  selectedPath: string;
  pathCount: number;
  diagnostics: string[];
}

interface ScoredCandidate {
  path: string;
  response: string;
  score: number;
  diagnostics: string[];
}

const STRATEGIES = [
  "systems-first",
  "clarity-first",
  "evidence-first",
  "creative-synthesis"
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function scoreResponse(text: string): number {
  const normalized = String(text || "").trim();
  if (!normalized) return 1;

  let score = 50;
  const length = normalized.length;
  if (length >= 180 && length <= 3500) score += 25;
  if (/\b(next|build|implement|phase|module|runtime|memory)\b/i.test(normalized)) score += 15;
  if (/\b(as an ai|off topic|random thought)\b/i.test(normalized)) score -= 20;
  return clamp(score, 1, 100);
}

function resolvePathCount(env: SimulationEnv): number {
  const requested = Number(env.OMNI_SIMULATION_PATHS || 2);
  if (!Number.isFinite(requested)) return 2;
  return clamp(Math.floor(requested), 2, 4);
}

export async function runInternalSimulation(input: InternalSimulationInput): Promise<InternalSimulationResult> {
  const pathCount = resolvePathCount(input.env);
  const candidates: ScoredCandidate[] = [];

  for (let index = 0; index < pathCount; index += 1) {
    const path = STRATEGIES[index] || `path-${index + 1}`;
    const stack = await runReasoningStack({
      env: input.env,
      model: input.model,
      identity: input.identity,
      messages: input.messages,
      maxOutputTokens: input.maxOutputTokens,
      strategy: path
    });

    const score = Math.floor(stack.metaScore * 0.55 + scoreResponse(stack.response) * 0.45);
    candidates.push({
      path,
      response: stack.response,
      score,
      diagnostics: stack.diagnostics
    });
  }

  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  const aggregateDiagnostics = [
    `simulation:paths=${pathCount}`,
    ...candidates.map((candidate) => `simulation:${candidate.path}:score=${candidate.score}`),
    ...best.diagnostics.slice(0, 8)
  ];

  return {
    response: best.response,
    selectedPath: best.path,
    pathCount,
    diagnostics: aggregateDiagnostics
  };
}

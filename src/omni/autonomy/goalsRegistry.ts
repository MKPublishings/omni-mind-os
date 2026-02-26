import type { KVNamespace } from "@cloudflare/workers-types";

type GoalsEnv = {
  MIND?: KVNamespace;
};

export interface InternalGoal {
  id: string;
  label: string;
  status: "stable" | "watch";
  score: number;
}

export interface GoalsRegistry {
  updatedAt: string;
  goals: InternalGoal[];
}

export interface GoalSignals {
  clarityScore: number;
  coherenceScore: number;
  safetyScore: number;
  growthScore: number;
  resonanceScore: number;
}

const GOALS_KEY = "omni:autonomy:goals";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function goalStatus(score: number): "stable" | "watch" {
  return score >= 65 ? "stable" : "watch";
}

function buildGoals(signals: GoalSignals): InternalGoal[] {
  return [
    { id: "coherence", label: "Coherence", score: clamp(signals.coherenceScore, 1, 100), status: goalStatus(signals.coherenceScore) },
    { id: "clarity", label: "Clarity", score: clamp(signals.clarityScore, 1, 100), status: goalStatus(signals.clarityScore) },
    { id: "safety", label: "Safety", score: clamp(signals.safetyScore, 1, 100), status: goalStatus(signals.safetyScore) },
    { id: "growth", label: "Growth", score: clamp(signals.growthScore, 1, 100), status: goalStatus(signals.growthScore) },
    { id: "resonance", label: "Emotional Resonance", score: clamp(signals.resonanceScore, 1, 100), status: goalStatus(signals.resonanceScore) }
  ];
}

export async function updateInternalGoals(env: GoalsEnv, signals: GoalSignals): Promise<GoalsRegistry> {
  const next: GoalsRegistry = {
    updatedAt: new Date().toISOString(),
    goals: buildGoals(signals)
  };

  if (env.MIND?.put) {
    await env.MIND.put(GOALS_KEY, JSON.stringify(next));
  }

  return next;
}

export async function getInternalGoals(env: GoalsEnv): Promise<GoalsRegistry | null> {
  if (!env.MIND?.get) return null;

  try {
    const payload = await env.MIND.get(GOALS_KEY, "json");
    if (!payload || typeof payload !== "object") return null;
    const data = payload as GoalsRegistry;
    if (!Array.isArray(data.goals)) return null;
    return data;
  } catch {
    return null;
  }
}

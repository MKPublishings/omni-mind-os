import type { KVNamespace } from "@cloudflare/workers-types";
import { detectEmotion } from "../emotion/detector";

type ResonanceEnv = {
  MEMORY?: KVNamespace;
};

export interface EmotionalResonanceState {
  sessionId: string;
  userEmotion: string;
  omniTone: string;
  arc: string;
  updatedAt: number;
}

const RESONANCE_PREFIX = "omni:resonance:";

function normalizeText(value: unknown): string {
  return String(value || "").trim();
}

function mapOmniTone(userEmotion: string): string {
  const emotion = normalizeText(userEmotion).toLowerCase();
  if (emotion === "frustrated") return "calm-guiding";
  if (emotion === "confused") return "clarifying";
  if (emotion === "positive") return "energized-focused";
  if (emotion === "apologetic") return "reassuring";
  return "steady-neutral";
}

function buildArcLabel(userEmotion: string, previousTone: string): string {
  const tone = mapOmniTone(userEmotion);
  if (!previousTone) return `stabilizing:${tone}`;
  if (previousTone === tone) return `continuity:${tone}`;
  return `transition:${previousTone}->${tone}`;
}

export async function getEmotionalResonance(
  env: ResonanceEnv,
  sessionIdRaw: string,
  latestUserText: string,
  fallbackTone = "neutral"
): Promise<EmotionalResonanceState> {
  const sessionId = normalizeText(sessionIdRaw) || "anon";
  const key = `${RESONANCE_PREFIX}${sessionId}`;

  let previous: Partial<EmotionalResonanceState> | null = null;
  if (env.MEMORY?.get) {
    try {
      const payload = await env.MEMORY.get(key, "json");
      if (payload && typeof payload === "object") {
        previous = payload as Partial<EmotionalResonanceState>;
      }
    } catch {
      previous = null;
    }
  }

  const userEmotion = detectEmotion(latestUserText || "") || fallbackTone;
  const previousTone = normalizeText(previous?.omniTone);
  const omniTone = mapOmniTone(userEmotion);

  return {
    sessionId,
    userEmotion,
    omniTone,
    arc: buildArcLabel(userEmotion, previousTone),
    updatedAt: Date.now()
  };
}

export async function persistEmotionalResonance(env: ResonanceEnv, state: EmotionalResonanceState): Promise<void> {
  if (!env.MEMORY?.put) return;

  const key = `${RESONANCE_PREFIX}${state.sessionId}`;
  await env.MEMORY.put(key, JSON.stringify(state));
}

export function buildEmotionalResonancePrompt(state: EmotionalResonanceState): string {
  return [
    "Emotional Resonance Engine is active.",
    `User emotional state: ${state.userEmotion}`,
    `Omni tonal target: ${state.omniTone}`,
    `Conversation arc: ${state.arc}`
  ].join("\n");
}

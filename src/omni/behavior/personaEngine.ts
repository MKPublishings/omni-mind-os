import type { KVNamespace } from "@cloudflare/workers-types";

type PersonaEnv = {
  MIND?: KVNamespace;
};

export interface PersonaProfile {
  tone: string;
  dialect: string;
  rhythm: string;
  framing: string;
  values: string[];
}

const PERSONA_KEY = "omni:persona:profile";

const DEFAULT_PERSONA: PersonaProfile = {
  tone: "clear and cinematic",
  dialect: "mythic-technical",
  rhythm: "deliberate and concise",
  framing: "systems narrative",
  values: ["coherence", "clarity", "resonance", "stability"]
};

function normalizeText(value: unknown): string {
  return String(value || "").trim();
}

function sanitizeProfile(input?: Partial<PersonaProfile> | null): PersonaProfile {
  const values = Array.isArray(input?.values)
    ? input?.values.map((value) => normalizeText(value)).filter(Boolean).slice(0, 8)
    : [];

  return {
    tone: normalizeText(input?.tone) || DEFAULT_PERSONA.tone,
    dialect: normalizeText(input?.dialect) || DEFAULT_PERSONA.dialect,
    rhythm: normalizeText(input?.rhythm) || DEFAULT_PERSONA.rhythm,
    framing: normalizeText(input?.framing) || DEFAULT_PERSONA.framing,
    values: values.length ? values : [...DEFAULT_PERSONA.values]
  };
}

function profileByMode(mode: string): Partial<PersonaProfile> {
  const normalized = normalizeText(mode).toLowerCase();

  if (normalized === "creative" || normalized === "lore") {
    return {
      tone: "expressive and cinematic",
      rhythm: "flowing narrative cadence",
      framing: "mythic storytelling"
    };
  }

  if (normalized === "analysis" || normalized === "analyst" || normalized === "reasoning") {
    return {
      tone: "precise and grounded",
      rhythm: "structured analytical pacing",
      framing: "evidence-first logic"
    };
  }

  if (normalized === "os" || normalized === "system-knowledge" || normalized === "coding") {
    return {
      tone: "operational and direct",
      rhythm: "high-signal concise",
      framing: "execution-oriented systems"
    };
  }

  return {
    tone: "clear and cinematic",
    rhythm: "deliberate and concise",
    framing: "systems narrative"
  };
}

export async function resolvePersonaProfile(env: PersonaEnv, mode: string): Promise<PersonaProfile> {
  let persisted: Partial<PersonaProfile> | null = null;

  if (env.MIND?.get) {
    try {
      const payload = await env.MIND.get(PERSONA_KEY, "json");
      if (payload && typeof payload === "object") {
        persisted = payload as Partial<PersonaProfile>;
      }
    } catch {
      persisted = null;
    }
  }

  const merged = sanitizeProfile({
    ...DEFAULT_PERSONA,
    ...persisted,
    ...profileByMode(mode)
  });

  return merged;
}

export function buildPersonaPrompt(profile: PersonaProfile): string {
  return [
    "Persona Engine is active.",
    `Tone: ${profile.tone}`,
    `Dialect: ${profile.dialect}`,
    `Rhythm: ${profile.rhythm}`,
    `Framing: ${profile.framing}`,
    `Values: ${profile.values.join(", ")}`
  ].join("\n");
}

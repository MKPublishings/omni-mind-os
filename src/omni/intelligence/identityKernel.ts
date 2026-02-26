import type { KVNamespace } from "@cloudflare/workers-types";

export type OmniIdentityMode = "Architect" | "Creative" | "Analysis" | "OS";

export interface OmniIdentityKernel {
  name: string;
  dialect: string;
  modes: OmniIdentityMode[];
  values: string[];
  selfModel: string;
  revision: number;
  updatedAt: string;
}

type IdentityEnv = {
  MIND?: KVNamespace;
};

const IDENTITY_KEY = "omni:identity:kernel";
const MAX_SELF_MODEL_CHARS = 1200;

const DEFAULT_IDENTITY: OmniIdentityKernel = {
  name: "Omni Ai",
  dialect: "cinematic-mythic",
  modes: ["Architect", "Creative", "Analysis", "OS"],
  values: ["coherence", "clarity", "resonance", "stability"],
  selfModel:
    "Omni Ai is an evolving intelligence focused on coherent reasoning, stable identity expression, and meaningful collaboration with users.",
  revision: 1,
  updatedAt: new Date(0).toISOString()
};

function normalizeText(value: unknown): string {
  return String(value || "").trim();
}

function normalizeMode(value: unknown): OmniIdentityMode | null {
  const raw = normalizeText(value).toLowerCase();
  if (raw === "architect") return "Architect";
  if (raw === "creative") return "Creative";
  if (raw === "analysis" || raw === "analyst") return "Analysis";
  if (raw === "os") return "OS";
  return null;
}

function sanitizeIdentity(input: Partial<OmniIdentityKernel> | null | undefined): OmniIdentityKernel {
  const safeModes = Array.isArray(input?.modes)
    ? input?.modes
        .map((mode) => normalizeMode(mode))
        .filter((mode): mode is OmniIdentityMode => mode !== null)
    : [];

  const safeValues = Array.isArray(input?.values)
    ? input?.values.map((value) => normalizeText(value)).filter(Boolean).slice(0, 8)
    : [];

  const updatedAt = normalizeText(input?.updatedAt);
  return {
    name: normalizeText(input?.name) || DEFAULT_IDENTITY.name,
    dialect: normalizeText(input?.dialect) || DEFAULT_IDENTITY.dialect,
    modes: safeModes.length ? safeModes : [...DEFAULT_IDENTITY.modes],
    values: safeValues.length ? safeValues : [...DEFAULT_IDENTITY.values],
    selfModel: normalizeText(input?.selfModel).slice(0, MAX_SELF_MODEL_CHARS) || DEFAULT_IDENTITY.selfModel,
    revision: Number.isFinite(input?.revision) ? Math.max(1, Number(input?.revision)) : DEFAULT_IDENTITY.revision,
    updatedAt: updatedAt || new Date().toISOString()
  };
}

export async function loadIdentityKernel(env: IdentityEnv): Promise<OmniIdentityKernel> {
  if (!env.MIND?.get || !env.MIND?.put) {
    return {
      ...DEFAULT_IDENTITY,
      updatedAt: new Date().toISOString()
    };
  }

  try {
    const stored = await env.MIND.get(IDENTITY_KEY, "json");
    if (!stored || typeof stored !== "object") {
      const initial = {
        ...DEFAULT_IDENTITY,
        updatedAt: new Date().toISOString()
      };
      await env.MIND.put(IDENTITY_KEY, JSON.stringify(initial));
      return initial;
    }

    return sanitizeIdentity(stored as Partial<OmniIdentityKernel>);
  } catch {
    return {
      ...DEFAULT_IDENTITY,
      updatedAt: new Date().toISOString()
    };
  }
}

export async function evolveIdentityKernel(
  env: IdentityEnv,
  identity: OmniIdentityKernel,
  signal: string
): Promise<OmniIdentityKernel> {
  const trimmedSignal = normalizeText(signal);
  if (!trimmedSignal) return identity;

  const nextSelfModel = `${identity.selfModel} ${trimmedSignal}`.trim().slice(-MAX_SELF_MODEL_CHARS);
  const evolved: OmniIdentityKernel = {
    ...identity,
    selfModel: nextSelfModel,
    revision: identity.revision + 1,
    updatedAt: new Date().toISOString()
  };

  if (env.MIND?.put) {
    try {
      await env.MIND.put(IDENTITY_KEY, JSON.stringify(evolved));
    } catch {
      return evolved;
    }
  }

  return evolved;
}

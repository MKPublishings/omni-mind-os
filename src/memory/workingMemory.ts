import type { DurableObjectNamespace, KVNamespace } from "@cloudflare/workers-types";

type WorkingMemoryEnv = {
  MEMORY?: KVNamespace;
  OMNI_SESSION?: DurableObjectNamespace;
};

export interface WorkingMemoryState {
  sessionId: string;
  activeGoals: string[];
  emotionalTone: string;
  contextWindow: string[];
  lastMode: string;
  updatedAt: number;
}

const SESSION_PREFIX = "omni:session:";
const MAX_WINDOW_ITEMS = 8;
const MAX_GOALS = 5;

function nowTs(): number {
  return Date.now();
}

function normalizeText(value: unknown): string {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function compactLine(value: unknown, maxChars: number): string {
  const text = normalizeText(value);
  if (!text) return "";
  return text.length > maxChars ? `${text.slice(0, maxChars - 3)}...` : text;
}

function createInitialState(sessionId: string): WorkingMemoryState {
  return {
    sessionId,
    activeGoals: [],
    emotionalTone: "neutral",
    contextWindow: [],
    lastMode: "auto",
    updatedAt: nowTs()
  };
}

function sanitizeState(sessionId: string, state?: Partial<WorkingMemoryState> | null): WorkingMemoryState {
  const goals = Array.isArray(state?.activeGoals)
    ? state?.activeGoals.map((goal) => compactLine(goal, 160)).filter(Boolean).slice(0, MAX_GOALS)
    : [];

  const contextWindow = Array.isArray(state?.contextWindow)
    ? state?.contextWindow.map((line) => compactLine(line, 280)).filter(Boolean).slice(-MAX_WINDOW_ITEMS)
    : [];

  const updatedAt = Number(state?.updatedAt || 0);

  return {
    sessionId,
    activeGoals: goals,
    emotionalTone: compactLine(state?.emotionalTone, 80) || "neutral",
    contextWindow,
    lastMode: compactLine(state?.lastMode, 64) || "auto",
    updatedAt: Number.isFinite(updatedAt) && updatedAt > 0 ? updatedAt : nowTs()
  };
}

async function loadFromDurableObject(env: WorkingMemoryEnv, sessionId: string): Promise<WorkingMemoryState | null> {
  if (!env.OMNI_SESSION?.idFromName || !env.OMNI_SESSION?.get) return null;

  try {
    const id = env.OMNI_SESSION.idFromName(sessionId);
    const stub = env.OMNI_SESSION.get(id);
    const response = await stub.fetch("https://omni-session/get");
    if (!response.ok) return null;

    const payload = (await response.json()) as Partial<WorkingMemoryState>;
    return sanitizeState(sessionId, payload);
  } catch {
    return null;
  }
}

async function saveToDurableObject(env: WorkingMemoryEnv, sessionId: string, state: WorkingMemoryState): Promise<boolean> {
  if (!env.OMNI_SESSION?.idFromName || !env.OMNI_SESSION?.get) return false;

  try {
    const id = env.OMNI_SESSION.idFromName(sessionId);
    const stub = env.OMNI_SESSION.get(id);
    const response = await stub.fetch("https://omni-session/set", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state)
    });

    return response.ok;
  } catch {
    return false;
  }
}

export async function loadWorkingMemory(env: WorkingMemoryEnv, sessionIdRaw: string): Promise<WorkingMemoryState> {
  const sessionId = compactLine(sessionIdRaw || "anon", 120) || "anon";

  const durable = await loadFromDurableObject(env, sessionId);
  if (durable) return durable;

  if (!env.MEMORY?.get) return createInitialState(sessionId);

  try {
    const key = `${SESSION_PREFIX}${sessionId}`;
    const payload = await env.MEMORY.get(key, "json");
    if (!payload || typeof payload !== "object") return createInitialState(sessionId);
    return sanitizeState(sessionId, payload as Partial<WorkingMemoryState>);
  } catch {
    return createInitialState(sessionId);
  }
}

export async function saveWorkingMemory(env: WorkingMemoryEnv, state: WorkingMemoryState): Promise<void> {
  const safe = sanitizeState(state.sessionId, state);

  const savedToDO = await saveToDurableObject(env, safe.sessionId, safe);
  if (savedToDO) return;
  if (!env.MEMORY?.put) return;

  const key = `${SESSION_PREFIX}${safe.sessionId}`;
  await env.MEMORY.put(key, JSON.stringify(safe));
}

export async function updateWorkingMemoryFromTurn(
  env: WorkingMemoryEnv,
  options: {
    sessionId: string;
    mode: string;
    userText: string;
    assistantText: string;
    emotionalTone?: string;
  }
): Promise<WorkingMemoryState> {
  const current = await loadWorkingMemory(env, options.sessionId);

  const next: WorkingMemoryState = {
    ...current,
    lastMode: compactLine(options.mode, 64) || current.lastMode,
    emotionalTone: compactLine(options.emotionalTone, 80) || current.emotionalTone,
    contextWindow: [
      ...current.contextWindow,
      `USER: ${compactLine(options.userText, 220)}`,
      `OMNI: ${compactLine(options.assistantText, 220)}`
    ].filter(Boolean).slice(-MAX_WINDOW_ITEMS),
    updatedAt: nowTs()
  };

  const potentialGoal = compactLine(options.userText, 140);
  if (/\b(build|implement|create|plan|fix|design|upgrade)\b/i.test(potentialGoal)) {
    next.activeGoals = [...next.activeGoals, potentialGoal].slice(-MAX_GOALS);
  }

  await saveWorkingMemory(env, next);
  return next;
}

export function formatWorkingMemoryPrompt(state: WorkingMemoryState): string {
  return [
    `Session: ${state.sessionId}`,
    `Last mode: ${state.lastMode}`,
    `Emotional tone: ${state.emotionalTone}`,
    state.activeGoals.length ? `Active goals: ${state.activeGoals.join(" | ")}` : "",
    state.contextWindow.length ? `Context window:\n${state.contextWindow.join("\n")}` : ""
  ]
    .filter(Boolean)
    .join("\n");
}

export async function pruneWorkingMemory(env: WorkingMemoryEnv, maxAgeHours: number): Promise<number> {
  if (!env.MEMORY?.list || !env.MEMORY?.get || !env.MEMORY?.delete) return 0;

  const cutoff = nowTs() - Math.max(1, Math.min(720, Math.floor(maxAgeHours))) * 60 * 60 * 1000;
  let deleted = 0;
  let cursor: string | undefined;

  do {
    const page = await env.MEMORY.list({ prefix: SESSION_PREFIX, cursor, limit: 100 });
    cursor = page.list_complete ? undefined : page.cursor;

    for (const key of page.keys) {
      const state = await env.MEMORY.get(key.name, "json");
      const updatedAt = Number((state as any)?.updatedAt || 0);
      if (!updatedAt || updatedAt >= cutoff) continue;

      await env.MEMORY.delete(key.name);
      deleted += 1;
    }
  } while (cursor);

  return deleted;
}

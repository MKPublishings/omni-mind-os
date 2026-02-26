import type { KVNamespace } from "@cloudflare/workers-types";

type SimulationStatus = "active" | "paused";

type SimulationLogEntry = {
  ts: number;
  level: "info" | "warn";
  message: string;
};

export type SimulationState = {
  simulationId: string;
  status: SimulationStatus;
  stepsExecuted: number;
  rules: string[];
  memoryUsageBytes: number;
  logs: SimulationLogEntry[];
  updatedAt: number;
};

type SimulationMessage = {
  role?: string;
  content?: string;
};

type SimulationEnv = {
  MEMORY?: KVNamespace;
};

export type SimulationContext = {
  state: SimulationState;
  systemPrompt: string;
  logsSummary: string;
};

const SIMULATION_MEMORY_KEY = "omni:simulation:state";
const MAX_LOG_ENTRIES = 24;
const DEFAULT_RULES = [
  "domain: system-state",
  "time: linear",
  "entities: bounded",
  "transitions: deterministic-by-default",
  "logging: structured"
];

function nowTs() {
  return Date.now();
}

function normalizeText(value: unknown): string {
  return String(value || "").trim();
}

function parseRuleLines(raw: string): string[] {
  const source = normalizeText(raw);
  if (!source) return [];

  return source
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 32);
}

function extractRulesFromMessages(messages: SimulationMessage[]): string[] {
  const userMessages = (messages || [])
    .filter((m) => String(m?.role || "").toLowerCase() === "user")
    .map((m) => String(m?.content || ""));

  for (let i = userMessages.length - 1; i >= 0; i -= 1) {
    const content = userMessages[i];
    const blockMatch = content.match(/rules\s*:\s*([\s\S]+)/i);
    if (!blockMatch) continue;

    const parsed = parseRuleLines(blockMatch[1]);
    if (parsed.length) return parsed;
  }

  return [];
}

function estimateMemoryUsageBytes(state: Omit<SimulationState, "memoryUsageBytes">): number {
  try {
    return new TextEncoder().encode(JSON.stringify(state)).length;
  } catch {
    return JSON.stringify(state).length;
  }
}

function makeInitialState(): SimulationState {
  const base: Omit<SimulationState, "memoryUsageBytes"> = {
    simulationId: `sim_${nowTs()}`,
    status: "active",
    stepsExecuted: 0,
    rules: [...DEFAULT_RULES],
    logs: [{ ts: nowTs(), level: "info", message: "Simulation initialized" }],
    updatedAt: nowTs()
  };

  return {
    ...base,
    memoryUsageBytes: estimateMemoryUsageBytes(base)
  };
}

async function loadState(env: SimulationEnv): Promise<SimulationState> {
  if (!env.MEMORY?.get) return makeInitialState();

  try {
    const stored = await env.MEMORY.get(SIMULATION_MEMORY_KEY, "json");
    if (!stored || typeof stored !== "object") return makeInitialState();

    const state = stored as Partial<SimulationState>;
    const fallback = makeInitialState();

    const normalized: SimulationState = {
      simulationId: normalizeText(state.simulationId) || fallback.simulationId,
      status: state.status === "paused" ? "paused" : "active",
      stepsExecuted: Number.isFinite(state.stepsExecuted) ? Math.max(0, Number(state.stepsExecuted)) : 0,
      rules: Array.isArray(state.rules) && state.rules.length
        ? state.rules.map((rule) => normalizeText(rule)).filter(Boolean).slice(0, 32)
        : [...DEFAULT_RULES],
      memoryUsageBytes: Number.isFinite(state.memoryUsageBytes) ? Math.max(0, Number(state.memoryUsageBytes)) : 0,
      logs: Array.isArray(state.logs)
        ? state.logs
            .map((log) => ({
              ts: Number.isFinite(log?.ts) ? Number(log.ts) : nowTs(),
              level: (log?.level === "warn" ? "warn" : "info") as "info" | "warn",
              message: normalizeText(log?.message)
            }))
            .filter((log) => !!log.message)
            .slice(-MAX_LOG_ENTRIES)
        : [...fallback.logs],
      updatedAt: Number.isFinite(state.updatedAt) ? Number(state.updatedAt) : nowTs()
    };

    const recalcMemory = estimateMemoryUsageBytes({
      simulationId: normalized.simulationId,
      status: normalized.status,
      stepsExecuted: normalized.stepsExecuted,
      rules: normalized.rules,
      logs: normalized.logs,
      updatedAt: normalized.updatedAt
    });

    normalized.memoryUsageBytes = recalcMemory;
    return normalized;
  } catch {
    return makeInitialState();
  }
}

async function saveState(env: SimulationEnv, state: SimulationState): Promise<void> {
  if (!env.MEMORY?.put) return;
  await env.MEMORY.put(SIMULATION_MEMORY_KEY, JSON.stringify(state));
}

function appendLog(state: SimulationState, level: "info" | "warn", message: string) {
  state.logs.push({ ts: nowTs(), level, message });
  state.logs = state.logs.slice(-MAX_LOG_ENTRIES);
}

function detectControlAction(messages: SimulationMessage[]): "start" | "pause" | "reset" | "none" {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    if (String(msg?.role || "").toLowerCase() !== "user") continue;
    const text = String(msg?.content || "").toLowerCase();

    if (/\b(reset simulation|\/simulation\s+reset|terminate simulation)\b/.test(text)) return "reset";
    if (/\b(pause simulation|\/simulation\s+pause)\b/.test(text)) return "pause";
    if (/\b(start simulation|resume simulation|\/simulation\s+start)\b/.test(text)) return "start";
    break;
  }

  return "none";
}

function buildSystemPrompt(state: SimulationState): string {
  return [
    "You are Omni in Simulation Mode.",
    "Simulation profile: system-state simulator.",
    "Operate as a contained reality engine with strict rule adherence.",
    "Output must include: state summary, key transitions, and concise simulation log entries.",
    `Simulation ID: ${state.simulationId}`,
    `Status: ${state.status}`,
    `Steps Executed: ${state.stepsExecuted}`,
    "Rules:",
    ...state.rules.map((rule, index) => `${index + 1}. ${rule}`)
  ].join("\n");
}

function buildLogsSummary(state: SimulationState): string {
  const recent = state.logs.slice(-8);
  if (!recent.length) return "No simulation logs yet.";

  return recent
    .map((log) => {
      const stamp = new Date(log.ts).toISOString();
      return `[${stamp}] ${log.level.toUpperCase()}: ${log.message}`;
    })
    .join("\n");
}

export async function advanceSimulationState(env: SimulationEnv, messages: SimulationMessage[]): Promise<SimulationContext> {
  const state = await loadState(env);
  const incomingRules = extractRulesFromMessages(messages);
  if (incomingRules.length) {
    state.rules = incomingRules;
    appendLog(state, "info", `Rules updated (${incomingRules.length})`);
  }

  const action = detectControlAction(messages);
  if (action === "reset") {
    state.simulationId = `sim_${nowTs()}`;
    state.status = "active";
    state.stepsExecuted = 0;
    state.rules = incomingRules.length ? incomingRules : [...DEFAULT_RULES];
    state.logs = [];
    appendLog(state, "warn", "Simulation reset from command");
  } else if (action === "pause") {
    state.status = "paused";
    appendLog(state, "info", "Simulation paused");
  } else if (action === "start") {
    state.status = "active";
    appendLog(state, "info", "Simulation started");
  }

  if (state.status === "active") {
    state.stepsExecuted += 1;
    appendLog(state, "info", `Executed step ${state.stepsExecuted}`);
  }

  state.updatedAt = nowTs();
  state.memoryUsageBytes = estimateMemoryUsageBytes({
    simulationId: state.simulationId,
    status: state.status,
    stepsExecuted: state.stepsExecuted,
    rules: state.rules,
    logs: state.logs,
    updatedAt: state.updatedAt
  });

  await saveState(env, state);

  return {
    state,
    systemPrompt: buildSystemPrompt(state),
    logsSummary: buildLogsSummary(state)
  };
}

import type { D1Database, KVNamespace } from "@cloudflare/workers-types";
import { getLongTermMemoryStats } from "../memory/d1Memory";
import { loadIdentityKernel } from "../omni/intelligence/identityKernel";
import { getInternalGoals } from "../omni/autonomy/goalsRegistry";

type MaintenanceStatusEnv = {
  MEMORY?: KVNamespace;
  MIND?: KVNamespace;
  OMNI_DB?: D1Database;
};

type LastMaintenanceRecord = {
  ranAt?: string;
  prunedLongTermRows?: number;
  prunedSessionEntries?: number;
  identityRevision?: number;
  autonomy?: {
    healingScore?: number;
    healingIssues?: string[];
    policyLevel?: string;
    recommendedCadenceMinutes?: number;
    goalsWatchCount?: number;
  };
};

export interface MaintenanceStatusReport {
  health: "ok" | "degraded";
  generatedAt: string;
  identity: {
    name: string;
    revision: number;
    updatedAt: string;
  };
  maintenance: {
    lastRunAt: string | null;
    minutesSinceRun: number | null;
    lastPrunedLongTermRows: number;
    lastPrunedSessionEntries: number;
  };
  memory: {
    longTerm: {
      totalRows: number;
      rowsLast24h: number;
      distinctSessions: number;
      latestEntryAt: string | null;
    };
    workingSessions: {
      kvSessionKeys: number;
      listedSample: number;
    };
  };
  drift: {
    risk: "low" | "medium" | "high";
    indicators: string[];
  };
  autonomy: {
    healingScore: number;
    healingIssues: string[];
    policyLevel: string;
    recommendedCadenceMinutes: number;
    goalsWatchCount: number;
    goals: Array<{ id: string; label: string; status: string; score: number }>;
  };
}

function toMinutesSince(isoTs?: string | null): number | null {
  if (!isoTs) return null;
  const ts = Date.parse(isoTs);
  if (!Number.isFinite(ts)) return null;
  return Math.max(0, Math.floor((Date.now() - ts) / 60000));
}

async function countWorkingSessionKeys(env: MaintenanceStatusEnv): Promise<{ total: number; sample: number }> {
  if (!env.MEMORY?.list) {
    return { total: 0, sample: 0 };
  }

  let total = 0;
  let sample = 0;
  let cursor: string | undefined;

  do {
    const page = await env.MEMORY.list({ prefix: "omni:session:", cursor, limit: 200 });
    total += page.keys.length;
    sample = Math.max(sample, page.keys.length);
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);

  return { total, sample };
}

function computeDriftRisk(input: { minutesSinceRun: number | null; rowsLast24h: number; identityRevision: number }) {
  const indicators: string[] = [];

  if (input.minutesSinceRun === null || input.minutesSinceRun > 180) {
    indicators.push("maintenance-stale");
  }
  if (input.rowsLast24h === 0) {
    indicators.push("memory-ingestion-low");
  }
  if (input.identityRevision < 2) {
    indicators.push("identity-revision-early");
  }

  if (indicators.length >= 2) return { risk: "high" as const, indicators };
  if (indicators.length === 1) return { risk: "medium" as const, indicators };
  return { risk: "low" as const, indicators: ["stable"] };
}

export async function getMaintenanceStatus(env: MaintenanceStatusEnv): Promise<MaintenanceStatusReport> {
  const [identity, longTerm, workingSessionCount, lastMaintenance, goals] = await Promise.all([
    loadIdentityKernel(env),
    getLongTermMemoryStats(env),
    countWorkingSessionKeys(env),
    env.MIND?.get ? env.MIND.get("omni:maintenance:last", "json") : Promise.resolve(null),
    getInternalGoals(env)
  ]);

  const last = (lastMaintenance || {}) as LastMaintenanceRecord;
  const lastRunAt = last?.ranAt || null;
  const minutesSinceRun = toMinutesSince(lastRunAt);
  const drift = computeDriftRisk({
    minutesSinceRun,
    rowsLast24h: longTerm.rowsLast24h,
    identityRevision: identity.revision
  });

  return {
    health: drift.risk === "high" ? "degraded" : "ok",
    generatedAt: new Date().toISOString(),
    identity: {
      name: identity.name,
      revision: identity.revision,
      updatedAt: identity.updatedAt
    },
    maintenance: {
      lastRunAt,
      minutesSinceRun,
      lastPrunedLongTermRows: Number(last?.prunedLongTermRows || 0),
      lastPrunedSessionEntries: Number(last?.prunedSessionEntries || 0)
    },
    memory: {
      longTerm,
      workingSessions: {
        kvSessionKeys: workingSessionCount.total,
        listedSample: workingSessionCount.sample
      }
    },
    drift,
    autonomy: {
      healingScore: Number(last?.autonomy?.healingScore || 0),
      healingIssues: Array.isArray(last?.autonomy?.healingIssues) ? last.autonomy.healingIssues : [],
      policyLevel: String(last?.autonomy?.policyLevel || "balanced"),
      recommendedCadenceMinutes: Number(last?.autonomy?.recommendedCadenceMinutes || 30),
      goalsWatchCount: Number(last?.autonomy?.goalsWatchCount || 0),
      goals: Array.isArray(goals?.goals)
        ? goals!.goals.map((goal) => ({
            id: goal.id,
            label: goal.label,
            status: goal.status,
            score: goal.score
          }))
        : []
    }
  };
}

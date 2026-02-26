import type { D1Database, KVNamespace } from "@cloudflare/workers-types";
import { ensureOmniMemorySchema, getLongTermMemoryStats, pruneMemoryOlderThanDays } from "../memory/d1Memory";
import { pruneWorkingMemory } from "../memory/workingMemory";
import { loadIdentityKernel, evolveIdentityKernel } from "../omni/intelligence/identityKernel";
import { evaluateSelfHealing, persistSelfHealingReport } from "../omni/autonomy/selfHealing";
import { resolveSchedulerPolicy } from "../omni/autonomy/schedulerPolicy";
import { updateInternalGoals } from "../omni/autonomy/goalsRegistry";

type MaintenanceEnv = {
  MEMORY?: KVNamespace;
  MIND?: KVNamespace;
  OMNI_DB?: D1Database;
  OMNI_MEMORY_RETENTION_DAYS?: string;
  OMNI_SESSION_MAX_AGE_HOURS?: string;
  OMNI_AUTONOMY_LEVEL?: string;
};

type LastMaintenanceRecord = {
  ranAt?: string;
};

export interface SelfMaintenanceReport {
  ranAt: string;
  prunedLongTermRows: number;
  prunedSessionEntries: number;
  identityRevision: number;
  autonomy: {
    healingScore: number;
    healingIssues: string[];
    policyLevel: string;
    recommendedCadenceMinutes: number;
    goalsWatchCount: number;
  };
}

function toBoundedInt(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

function toMinutesSince(isoTs?: string): number | null {
  if (!isoTs) return null;
  const ts = Date.parse(isoTs);
  if (!Number.isFinite(ts)) return null;
  return Math.max(0, Math.floor((Date.now() - ts) / 60000));
}

export async function runSelfMaintenance(env: MaintenanceEnv): Promise<SelfMaintenanceReport> {
  await ensureOmniMemorySchema(env);

  const retentionDays = toBoundedInt(env.OMNI_MEMORY_RETENTION_DAYS, 45, 7, 365);
  const sessionMaxAgeHours = toBoundedInt(env.OMNI_SESSION_MAX_AGE_HOURS, 72, 1, 720);

  const [prunedLongTermRows, prunedSessionEntries] = await Promise.all([
    pruneMemoryOlderThanDays(env, retentionDays),
    pruneWorkingMemory(env, sessionMaxAgeHours)
  ]);

  const [longTermStats, previousMaintenance] = await Promise.all([
    getLongTermMemoryStats(env),
    env.MIND?.get ? env.MIND.get("omni:maintenance:last", "json") : Promise.resolve(null)
  ]);

  const last = (previousMaintenance || {}) as LastMaintenanceRecord;
  const lastMaintenanceMinutes = toMinutesSince(last.ranAt);

  const identity = await loadIdentityKernel(env);
  const evolved = await evolveIdentityKernel(
    env,
    identity,
    "Scheduled maintenance: reinforcement of coherence, clarity, resonance, and stability."
  );

  const healing = evaluateSelfHealing({
    lastMaintenanceMinutes,
    identityRevision: evolved.revision,
    rowsLast24h: longTermStats.rowsLast24h
  });

  const policy = resolveSchedulerPolicy({
    autonomyLevel: env.OMNI_AUTONOMY_LEVEL,
    healingScore: healing.score,
    rowsLast24h: longTermStats.rowsLast24h
  });

  const goals = await updateInternalGoals(env, {
    coherenceScore: healing.score,
    clarityScore: Math.min(100, healing.score + 4),
    safetyScore: Math.max(55, healing.score),
    growthScore: longTermStats.rowsLast24h > 0 ? 80 : 58,
    resonanceScore: longTermStats.rowsLast24h > 5 ? 82 : 64
  });

  await persistSelfHealingReport(env, healing);

  const goalsWatchCount = goals.goals.filter((goal) => goal.status === "watch").length;

  if (env.MIND?.put) {
    await env.MIND.put(
      "omni:maintenance:last",
      JSON.stringify({
        ranAt: new Date().toISOString(),
        prunedLongTermRows,
        prunedSessionEntries,
        identityRevision: evolved.revision,
        autonomy: {
          healingScore: healing.score,
          healingIssues: healing.issues,
          policyLevel: policy.level,
          recommendedCadenceMinutes: policy.recommendedCadenceMinutes,
          goalsWatchCount
        }
      })
    );
  }

  return {
    ranAt: new Date().toISOString(),
    prunedLongTermRows,
    prunedSessionEntries,
    identityRevision: evolved.revision,
    autonomy: {
      healingScore: healing.score,
      healingIssues: healing.issues,
      policyLevel: policy.level,
      recommendedCadenceMinutes: policy.recommendedCadenceMinutes,
      goalsWatchCount
    }
  };
}

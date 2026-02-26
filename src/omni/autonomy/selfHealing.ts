import type { KVNamespace } from "@cloudflare/workers-types";

type HealingEnv = {
  MIND?: KVNamespace;
};

export interface SelfHealingInput {
  lastMaintenanceMinutes: number | null;
  identityRevision: number;
  rowsLast24h: number;
}

export interface SelfHealingReport {
  score: number;
  issues: string[];
  actions: string[];
  corrected: boolean;
}

const HEALING_LOG_KEY = "omni:autonomy:self-healing:last";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function evaluateSelfHealing(input: SelfHealingInput): SelfHealingReport {
  const issues: string[] = [];
  const actions: string[] = [];

  if (input.lastMaintenanceMinutes === null || input.lastMaintenanceMinutes > 180) {
    issues.push("maintenance-stale");
    actions.push("prioritize-maintenance-cycle");
  }

  if (input.identityRevision < 3) {
    issues.push("identity-revision-low");
    actions.push("reinforce-identity-kernel");
  }

  if (input.rowsLast24h <= 0) {
    issues.push("memory-ingestion-low");
    actions.push("promote-memory-capture");
  }

  let score = 100 - issues.length * 25;
  if (input.rowsLast24h > 20) {
    score += 8;
  }

  return {
    score: clamp(score, 1, 100),
    issues,
    actions,
    corrected: issues.length > 0
  };
}

export async function persistSelfHealingReport(env: HealingEnv, report: SelfHealingReport): Promise<void> {
  if (!env.MIND?.put) return;
  await env.MIND.put(
    HEALING_LOG_KEY,
    JSON.stringify({
      ...report,
      updatedAt: new Date().toISOString()
    })
  );
}

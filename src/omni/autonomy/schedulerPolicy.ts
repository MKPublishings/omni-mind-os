export type AutonomyLevel = "conservative" | "balanced" | "aggressive";

export interface SchedulerPolicyInput {
  autonomyLevel?: string;
  healingScore: number;
  rowsLast24h: number;
}

export interface SchedulerPolicy {
  level: AutonomyLevel;
  recommendedCadenceMinutes: number;
  priorityTasks: string[];
}

function normalizeLevel(value: unknown): AutonomyLevel {
  const text = String(value || "").trim().toLowerCase();
  if (text === "conservative") return "conservative";
  if (text === "aggressive") return "aggressive";
  return "balanced";
}

export function resolveSchedulerPolicy(input: SchedulerPolicyInput): SchedulerPolicy {
  const level = normalizeLevel(input.autonomyLevel);

  let cadence = 30;
  if (level === "conservative") cadence = 60;
  if (level === "aggressive") cadence = 15;

  if (input.healingScore < 60) {
    cadence = Math.max(10, cadence - 10);
  }

  const priorityTasks = ["memory-cleanup", "identity-reinforcement", "behavioral-alignment"];
  if (input.rowsLast24h === 0) {
    priorityTasks.push("memory-ingestion-recovery");
  }

  return {
    level,
    recommendedCadenceMinutes: cadence,
    priorityTasks
  };
}

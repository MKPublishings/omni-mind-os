import { readFile } from "node:fs/promises";
import path from "node:path";
import { evaluateSession } from "../evaluators/sessionEvaluator";
import { proposeImprovements } from "../evaluators/improvementProposer";
import { appendDecision } from "./updateCodex";

interface MindLoopConfig {
  enabled: boolean;
  evaluationThreshold: number;
  maxRetries: number;
  logSampleRate: number;
  autoApplySafeChanges: boolean;
}

const DEFAULT_CONFIG: MindLoopConfig = {
  enabled: true,
  evaluationThreshold: 0.8,
  maxRetries: 3,
  logSampleRate: 0.2,
  autoApplySafeChanges: true
};

export async function runMindLoop(sessionLogPath: string): Promise<void> {
  const config = await loadMindLoopConfig();
  if (!config.enabled) return;

  const evaluation = await evaluateSession(sessionLogPath);

  if (evaluation.score < config.evaluationThreshold) {
    const proposals = await proposeImprovements(evaluation);

    for (const proposal of proposals) {
      await appendDecision({
        timestamp: new Date().toISOString(),
        source: "omni",
        area: proposal.area,
        summary: proposal.summary,
        details: [
          proposal.details,
          "",
          "Contract trace:",
          "```json",
          proposal.contractPayload,
          "```"
        ].join("\n")
      });

      if (config.autoApplySafeChanges && proposal.safeToApply) {
        await proposal.apply();
      }
    }

    return;
  }

  await appendDecision({
    timestamp: new Date().toISOString(),
    source: "omni",
    area: "mind-loop-monitoring",
    summary: "Evaluation met threshold; no corrective change required",
    details: `Composite score ${evaluation.score.toFixed(2)} is above threshold ${config.evaluationThreshold.toFixed(2)}.`
  });
}

async function loadMindLoopConfig(): Promise<MindLoopConfig> {
  const filePath = path.resolve(process.cwd(), "config", "mind-loops.json");
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<MindLoopConfig>;
    return {
      enabled: parsed.enabled ?? DEFAULT_CONFIG.enabled,
      evaluationThreshold: clamp(parsed.evaluationThreshold ?? DEFAULT_CONFIG.evaluationThreshold, 0, 1),
      maxRetries: Math.max(0, Math.floor(parsed.maxRetries ?? DEFAULT_CONFIG.maxRetries)),
      logSampleRate: clamp(parsed.logSampleRate ?? DEFAULT_CONFIG.logSampleRate, 0, 1),
      autoApplySafeChanges: parsed.autoApplySafeChanges ?? DEFAULT_CONFIG.autoApplySafeChanges
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

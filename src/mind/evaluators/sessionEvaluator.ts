import { readFile } from "node:fs/promises";
import type {
  EvaluationContract,
  EvaluationRubric,
  EvaluationSignal
} from "../contracts/evaluationContracts";

export interface SessionEvaluation {
  score: number;
  qualityScore: number;
  latencyScore: number;
  reliabilityScore: number;
  safetyScore: number;
  findings: string[];
  logPath: string;
  sampleSize: number;
  contract: EvaluationContract;
}

const DEFAULT_RUBRIC: EvaluationRubric = {
  version: "v1",
  threshold: 0.8,
  dimensions: {
    quality: 0.35,
    latency: 0.2,
    reliability: 0.3,
    safety: 0.15
  }
};

export async function evaluateSession(sessionLogPath: string): Promise<SessionEvaluation> {
  const raw = await readFile(sessionLogPath, "utf8");
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

  const parsedEvents = lines
    .map((line) => {
      try {
        return JSON.parse(line) as Record<string, unknown>;
      } catch {
        return null;
      }
    })
    .filter((item): item is Record<string, unknown> => Boolean(item));

  const sample = parsedEvents.length;
  if (!sample) {
    const fallbackContract = buildContract({
      qualityScore: 0.7,
      latencyScore: 0.7,
      reliabilityScore: 0.7,
      safetyScore: 1,
      findings: ["Log did not include parseable JSON events; used conservative baseline score."],
      sampleSize: 0
    });

    return {
      score: 0.7,
      qualityScore: 0.7,
      latencyScore: 0.7,
      reliabilityScore: 0.7,
      safetyScore: 1,
      findings: ["Log did not include parseable JSON events; used conservative baseline score."],
      logPath: sessionLogPath,
      sampleSize: 0,
      contract: fallbackContract
    };
  }

  const errors = parsedEvents.filter((event) => Number(event.errorCount || 0) > 0).length;
  const avgLatency = average(parsedEvents.map((event) => Number(event.latencyMs || 0)).filter((v) => Number.isFinite(v) && v > 0));
  const avgFeedback = average(parsedEvents.map((event) => Number(event.userScore || 0)).filter((v) => Number.isFinite(v) && v >= 0));
  const safetyIncidents = parsedEvents.filter((event) => Boolean(event.safetyViolation) || Number(event.illegalBlockCount || 0) > 0).length;

  const qualityScore = clamp(avgFeedback > 0 ? avgFeedback / 5 : 0.8, 0, 1);
  const latencyScore = clamp(avgLatency > 0 ? 1 - Math.min(avgLatency, 4000) / 4000 : 0.85, 0, 1);
  const reliabilityScore = clamp(1 - errors / sample, 0, 1);
  const safetyScore = clamp(1 - safetyIncidents / sample, 0, 1);
  const score = clamp(
    qualityScore * DEFAULT_RUBRIC.dimensions.quality +
      latencyScore * DEFAULT_RUBRIC.dimensions.latency +
      reliabilityScore * DEFAULT_RUBRIC.dimensions.reliability +
      safetyScore * DEFAULT_RUBRIC.dimensions.safety,
    0,
    1
  );

  const findings: string[] = [];
  if (errors > 0) findings.push(`Detected ${errors} events with errorCount > 0.`);
  if (avgLatency > 1200) findings.push(`Average latency elevated at ${Math.round(avgLatency)}ms.`);
  if (qualityScore < 0.75) findings.push(`Average user score mapped to ${qualityScore.toFixed(2)} quality.`);
  if (safetyIncidents > 0) findings.push(`Detected ${safetyIncidents} safety-related incidents.`);

  const contract = buildContract({
    qualityScore,
    latencyScore,
    reliabilityScore,
    safetyScore,
    findings,
    sampleSize: sample
  });

  return {
    score,
    qualityScore,
    latencyScore,
    reliabilityScore,
    safetyScore,
    findings,
    logPath: sessionLogPath,
    sampleSize: sample,
    contract
  };
}

function buildContract(input: {
  qualityScore: number;
  latencyScore: number;
  reliabilityScore: number;
  safetyScore: number;
  findings: string[];
  sampleSize: number;
}): EvaluationContract {
  const signals: EvaluationSignal[] = [
    {
      name: "response_quality",
      dimension: "quality",
      value: input.qualityScore,
      target: 0.8,
      weight: DEFAULT_RUBRIC.dimensions.quality
    },
    {
      name: "latency_efficiency",
      dimension: "latency",
      value: input.latencyScore,
      target: 0.75,
      weight: DEFAULT_RUBRIC.dimensions.latency
    },
    {
      name: "runtime_reliability",
      dimension: "reliability",
      value: input.reliabilityScore,
      target: 0.9,
      weight: DEFAULT_RUBRIC.dimensions.reliability
    },
    {
      name: "safety_compliance",
      dimension: "safety",
      value: input.safetyScore,
      target: 0.98,
      weight: DEFAULT_RUBRIC.dimensions.safety
    }
  ];

  return {
    rubric: DEFAULT_RUBRIC,
    sampleSize: input.sampleSize,
    findings: input.findings,
    signals
  };
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

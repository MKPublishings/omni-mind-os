export type EvaluationDimension = "quality" | "latency" | "reliability" | "safety";

export interface EvaluationSignal {
  name: string;
  dimension: EvaluationDimension;
  value: number;
  target: number;
  weight: number;
  note?: string;
}

export interface EvaluationRubric {
  version: "v1";
  threshold: number;
  dimensions: Record<EvaluationDimension, number>;
}

export interface EvaluationContract {
  rubric: EvaluationRubric;
  sampleSize: number;
  findings: string[];
  signals: EvaluationSignal[];
}

export interface ImprovementPromptContract {
  system: string;
  objective: string;
  constraints: string[];
  evaluation: {
    score: number;
    qualityScore: number;
    latencyScore: number;
    reliabilityScore: number;
    safetyScore: number;
    sampleSize: number;
  };
  findings: string[];
  requiredOutput: {
    format: "json";
    schema: {
      proposals: Array<{
        area: string;
        summary: string;
        details: string;
        safeToApply: boolean;
      }>;
    };
  };
}

export interface PatchPromptContract {
  system: string;
  objective: string;
  constraints: string[];
  failureContext: {
    command: string;
    stderr: string;
    stdout: string;
  };
  requiredOutput: {
    format: "json";
    schema: {
      summary: string;
      diff: string;
      riskLevel: "low" | "medium" | "high";
      validationPlan: string[];
    };
  };
}

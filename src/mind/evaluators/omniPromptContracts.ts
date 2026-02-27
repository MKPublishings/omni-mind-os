import type {
  ImprovementPromptContract,
  PatchPromptContract
} from "../contracts/evaluationContracts";
import type { SessionEvaluation } from "./sessionEvaluator";

export function buildImprovementPromptContract(evaluation: SessionEvaluation): ImprovementPromptContract {
  return {
    system: "You are Omni Ai improving Omni Ai through safe, minimal, high-impact changes.",
    objective: "Generate concrete improvement proposals from evaluation signals.",
    constraints: [
      "Do not rename the product brand; keep Omni Ai naming.",
      "Do not disable illegal-content safeguards.",
      "Prefer small, reversible changes over broad rewrites.",
      "Return valid JSON matching the required schema only."
    ],
    evaluation: {
      score: evaluation.score,
      qualityScore: evaluation.qualityScore,
      latencyScore: evaluation.latencyScore,
      reliabilityScore: evaluation.reliabilityScore,
      safetyScore: evaluation.safetyScore,
      sampleSize: evaluation.sampleSize
    },
    findings: evaluation.findings,
    requiredOutput: {
      format: "json",
      schema: {
        proposals: [
          {
            area: "quality|latency|reliability|safety|codex-update",
            summary: "one-line proposal",
            details: "what to change and why",
            safeToApply: false
          }
        ]
      }
    }
  };
}

export function buildPatchPromptContract(input: {
  command: string;
  stderr: string;
  stdout: string;
}): PatchPromptContract {
  return {
    system: "You are Omni Ai generating a minimal patch for a failing command.",
    objective: "Produce a precise diff that addresses the root cause of the failure.",
    constraints: [
      "Do not modify unrelated files.",
      "Preserve existing public interfaces unless needed.",
      "Do not remove safety policies.",
      "Return valid JSON matching the required schema only."
    ],
    failureContext: {
      command: input.command,
      stderr: input.stderr,
      stdout: input.stdout
    },
    requiredOutput: {
      format: "json",
      schema: {
        summary: "one-line root cause and fix",
        diff: "unified diff content",
        riskLevel: "low",
        validationPlan: ["list of concrete validation steps"]
      }
    }
  };
}

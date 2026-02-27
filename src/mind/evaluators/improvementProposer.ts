import type { SessionEvaluation } from "./sessionEvaluator";
import { buildImprovementPromptContract } from "./omniPromptContracts";
import { requestMindImprovements } from "./internalMindClient";

export interface ImprovementProposal {
  area: string;
  summary: string;
  details: string;
  safeToApply: boolean;
  contractPayload: string;
  apply: () => Promise<void>;
}

export async function proposeImprovements(evaluation: SessionEvaluation): Promise<ImprovementProposal[]> {
  const fromInternal = await mapInternalMindProposals(evaluation);
  if (fromInternal.length) {
    return fromInternal;
  }

  return buildLocalFallbackProposals(evaluation);
}

async function mapInternalMindProposals(evaluation: SessionEvaluation): Promise<ImprovementProposal[]> {
  const contract = buildImprovementPromptContract(evaluation);
  const contractPayload = JSON.stringify(contract, null, 2);
  const response = await requestMindImprovements(evaluation);
  const rawProposals = Array.isArray(response?.proposals) ? response.proposals : [];

  return rawProposals
    .map((proposal) => {
      const area = String(proposal?.area || "").trim();
      const summary = String(proposal?.summary || "").trim();
      const details = String(proposal?.details || "").trim();
      if (!area || !summary || !details) return null;

      return createProposal({
        area,
        summary,
        details: [
          details,
          "",
          "Prompt contract payload:",
          "```json",
          contractPayload,
          "```"
        ].join("\n"),
        safeToApply: Boolean(proposal?.safeToApply),
        contractPayload
      });
    })
    .filter((proposal): proposal is ImprovementProposal => Boolean(proposal));
}

function buildLocalFallbackProposals(evaluation: SessionEvaluation): ImprovementProposal[] {
  const proposals: ImprovementProposal[] = [];
  const contract = buildImprovementPromptContract(evaluation);
  const contractPayload = JSON.stringify(contract, null, 2);

  if (evaluation.reliabilityScore < 0.9) {
    proposals.push(createProposal({
      area: "reliability",
      summary: "Increase defensive retries for unstable calls",
      details: [
        "Observed reliability degradation in recent session logs.",
        "Recommended action: increase retriable-path coverage for transient failures.",
        `Current reliability score: ${evaluation.reliabilityScore.toFixed(2)}`,
        "",
        "Prompt contract payload:",
        "```json",
        contractPayload,
        "```"
      ].join("\n"),
      contractPayload
    }));
  }

  if (evaluation.latencyScore < 0.7) {
    proposals.push(createProposal({
      area: "latency",
      summary: "Tune prompt and routing path for faster average response",
      details: [
        "Latency score dropped below preferred range.",
        "Recommended action: compact prompt templates and prioritize lower-latency routes where quality is unaffected.",
        `Current latency score: ${evaluation.latencyScore.toFixed(2)}`,
        "",
        "Prompt contract payload:",
        "```json",
        contractPayload,
        "```"
      ].join("\n"),
      contractPayload
    }));
  }

  if (evaluation.qualityScore < 0.75) {
    proposals.push(createProposal({
      area: "quality",
      summary: "Refresh response strategy for quality recovery",
      details: [
        "Quality score indicates user-visible response quality drift.",
        "Recommended action: refine system prompts and add response-evaluator feedback loop.",
        `Current quality score: ${evaluation.qualityScore.toFixed(2)}`,
        "",
        "Prompt contract payload:",
        "```json",
        contractPayload,
        "```"
      ].join("\n"),
      contractPayload
    }));
  }

  if (evaluation.safetyScore < 0.98) {
    proposals.push(createProposal({
      area: "safety",
      summary: "Harden safety policy handling for flagged sessions",
      details: [
        "Safety score indicates policy-adjacent incidents in sampled logs.",
        "Recommended action: add stricter classification traces and verify policy gate ordering.",
        `Current safety score: ${evaluation.safetyScore.toFixed(2)}`,
        "",
        "Prompt contract payload:",
        "```json",
        contractPayload,
        "```"
      ].join("\n"),
      contractPayload
    }));
  }

  if (!proposals.length) {
    proposals.push(createProposal({
      area: "codex-update",
      summary: "No critical issues detected; record monitoring snapshot",
      details: [
        "Evaluation score met threshold.",
        `Composite score: ${evaluation.score.toFixed(2)}`,
        `Sample size: ${evaluation.sampleSize}`,
        "",
        "Prompt contract payload:",
        "```json",
        contractPayload,
        "```"
      ].join("\n"),
      safeToApply: true,
      contractPayload
    }));
  }

  return proposals;
}

function createProposal(input: {
  area: string;
  summary: string;
  details: string;
  contractPayload: string;
  safeToApply?: boolean;
}): ImprovementProposal {
  return {
    area: input.area,
    summary: input.summary,
    details: input.details,
    contractPayload: input.contractPayload,
    safeToApply: input.safeToApply ?? false,
    apply: async () => {
      return;
    }
  };
}

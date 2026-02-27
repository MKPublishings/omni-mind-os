import type { SessionEvaluation } from "./sessionEvaluator";

export interface InternalMindProposal {
  area?: string;
  summary?: string;
  details?: string;
  safeToApply?: boolean;
}

export interface InternalMindImprovementsResponse {
  proposals?: InternalMindProposal[];
}

export async function requestMindImprovements(
  evaluation: SessionEvaluation
): Promise<InternalMindImprovementsResponse> {
  const baseUrl = process.env.INTERNAL_MIND_URL;
  if (!baseUrl) {
    return { proposals: [] };
  }

  const response = await fetch(`${baseUrl}/improvements`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ evaluation })
  });

  if (!response.ok) {
    return { proposals: [] };
  }

  const data = (await response.json()) as InternalMindImprovementsResponse;
  return {
    proposals: Array.isArray(data?.proposals) ? data.proposals : []
  };
}

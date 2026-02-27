import { spawn } from "node:child_process";
import { appendDecision } from "../../mind/self_improvement/updateCodex";
import { buildPatchPromptContract } from "../../mind/evaluators/omniPromptContracts";

export interface AutoDebugResult {
  success: boolean;
  exitCode: number | null;
  stderr: string;
  stdout: string;
  patchSummary?: string;
  riskLevel?: "low" | "medium" | "high";
  validationPlan?: string[];
  promptContract?: string;
  patchDiff?: string;
}

export async function runAutoDebugger(testCommand = "npm test"): Promise<AutoDebugResult> {
  const shellProc = spawn(testCommand, { shell: true });

  let stdout = "";
  let stderr = "";

  shellProc.stdout.on("data", (chunk) => {
    stdout += chunk.toString();
  });

  shellProc.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  const exitCode = await new Promise<number | null>((resolve) => {
    shellProc.on("close", (code) => resolve(code));
  });

  if (exitCode === 0) {
    return {
      success: true,
      exitCode,
      stderr,
      stdout
    };
  }

  const patchProposal = await callOmniForPatch({
    command: testCommand,
    stdout,
    stderr
  });

  await appendDecision({
    timestamp: new Date().toISOString(),
    source: "omni",
    area: "auto-debugger",
    summary: "Proposed patch for failing tests",
    details: [
      "### Error Trace",
      "```",
      stderr || stdout || "No output captured.",
      "```",
      "",
      "### Proposed Patch",
      "```diff",
      patchProposal.diff,
      "```",
      "",
      "### Validation Plan",
      ...patchProposal.validationPlan.map((step) => `- ${step}`),
      "",
      "### Prompt Contract",
      "```json",
      patchProposal.promptContract,
      "```"
    ].join("\n")
  });

  return {
    success: false,
    exitCode,
    stderr,
    stdout,
    patchSummary: patchProposal.summary,
    riskLevel: patchProposal.riskLevel,
    validationPlan: patchProposal.validationPlan,
    promptContract: patchProposal.promptContract,
    patchDiff: patchProposal.diff
  };
}

async function callOmniForPatch(input: {
  command: string;
  stderr: string;
  stdout: string;
}): Promise<{
  summary: string;
  diff: string;
  riskLevel: "low" | "medium" | "high";
  validationPlan: string[];
  promptContract: string;
}> {
  const promptContract = buildPatchPromptContract({
    command: input.command,
    stderr: input.stderr.slice(0, 5000),
    stdout: input.stdout.slice(0, 5000)
  });

  const internalPatch = await requestMindPatch({
    command: input.command,
    stderr: input.stderr,
    stdout: input.stdout
  });

  const internalExplanation = String(internalPatch?.explanation || "").trim();
  const internalDiff = String(internalPatch?.diff || "").trim();
  if (internalExplanation && internalDiff) {
    return {
      summary: internalExplanation,
      diff: internalDiff,
      riskLevel: "medium",
      validationPlan: [
        "Run focused tests for failing module.",
        "Run full workspace typecheck.",
        "Run smoke tests for impacted runtime paths."
      ],
      promptContract: JSON.stringify(promptContract, null, 2)
    };
  }

  const combined = `${input.stdout}\n${input.stderr}`.trim().slice(0, 1200);
  return {
    summary: "Generated placeholder patch contract from failing command context.",
    diff: `// patch proposal placeholder generated from failure trace\n// trace excerpt:\n// ${combined.replace(/\n/g, "\n// ")}`,
    riskLevel: "medium",
    validationPlan: [
      "Run focused tests for failing module.",
      "Run full workspace typecheck.",
      "Run smoke tests for impacted runtime paths."
    ],
    promptContract: JSON.stringify(promptContract, null, 2)
  };
}

export interface InternalMindPatchRequest {
  command: string;
  stderr: string;
  stdout: string;
}

export interface InternalMindPatchResponse {
  mode?: string;
  explanation?: string;
  diff?: string;
  [key: string]: unknown;
}

function resolveInternalMindEndpoint(): string {
  const base = String(process.env.OMNI_INTERNAL_MIND_URL || "http://127.0.0.1:8787/internal/mind").trim();
  return base || "http://127.0.0.1:8787/internal/mind";
}

export async function requestMindPatch(
  input: InternalMindPatchRequest
): Promise<InternalMindPatchResponse> {
  const endpoint = resolveInternalMindEndpoint();

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        mode: "patch",
        errorLog: `${input.stderr}\n${input.stdout}`.trim(),
        context: {
          files: [{ path: "src/tools/auto_debugger/autoDebugger.ts" }]
        }
      })
    });

    if (!response.ok) {
      return {};
    }

    const data = (await response.json().catch(() => ({}))) as InternalMindPatchResponse;
    return data && typeof data === "object" ? data : {};
  } catch {
    return {};
  }
}

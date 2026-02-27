import type { SessionEvaluation } from "../../mind/evaluators/sessionEvaluator";
import type { AutoDebugResult } from "../auto_debugger/autoDebugger";
import { createTaskToken, type TaskToken } from "./taskToken";

export function createEvaluationScheduleTokens(evaluation: SessionEvaluation, threshold = 0.8): TaskToken[] {
  if (evaluation.score < threshold) {
    return [
      createTaskToken({
        type: "refactor",
        summary: "Improve low-scoring evaluation dimensions from latest mind-loop run",
        contextFiles: [
          "src/mind/evaluators/sessionEvaluator.ts",
          "src/mind/evaluators/improvementProposer.ts",
          "src/mind/self_improvement/mindLoop.ts"
        ],
        acceptanceCriteria: [
          "Composite score exceeds configured threshold",
          "Top findings are reduced on next sampled run"
        ],
        createdBy: "omni",
        priority: "high"
      })
    ];
  }

  return [
    createTaskToken({
      type: "codex-update",
      summary: "Capture healthy mind-loop snapshot and keep monitoring trend",
      contextFiles: ["codex/40-decisions"],
      acceptanceCriteria: [
        "Monitoring snapshot logged",
        "No unresolved high-priority token from prior run"
      ],
      createdBy: "omni",
      priority: "low"
    })
  ];
}

export function createAutoDebugScheduleTokens(result: AutoDebugResult): TaskToken[] {
  if (result.success) {
    return [
      createTaskToken({
        type: "codex-update",
        summary: "Auto-debug pass is healthy; no patch action required",
        contextFiles: ["src/tools/auto_debugger/autoDebugger.ts"],
        acceptanceCriteria: ["No failing command from the last debug run"],
        createdBy: "omni",
        priority: "low"
      })
    ];
  }

  return [
    createTaskToken({
      type: "bug",
      summary: "Resolve failing command identified by auto-debugger",
      contextFiles: ["src/tools/auto_debugger/autoDebugger.ts"],
      acceptanceCriteria: [
        "Previously failing command exits successfully",
        "Typecheck and smoke tests remain passing"
      ],
      createdBy: "omni",
      priority: result.riskLevel === "high" ? "high" : "medium"
    })
  ];
}

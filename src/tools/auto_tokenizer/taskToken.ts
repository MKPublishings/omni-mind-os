import { randomUUID } from "node:crypto";

export interface TaskToken {
  id: string;
  type: "bug" | "feature" | "refactor" | "research" | "codex-update";
  contextFiles: string[];
  summary: string;
  acceptanceCriteria: string[];
  priority: "low" | "medium" | "high";
  status: "open" | "in-progress" | "resolved";
  createdBy: "omni" | "human";
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  metadata?: Record<string, unknown>;
}

export function createTaskToken(input: {
  type: TaskToken["type"];
  summary: string;
  contextFiles?: string[];
  acceptanceCriteria?: string[];
  createdBy?: TaskToken["createdBy"];
  priority?: TaskToken["priority"];
}): TaskToken {
  return {
    id: randomUUID(),
    type: input.type,
    contextFiles: input.contextFiles ?? [],
    summary: input.summary,
    acceptanceCriteria: input.acceptanceCriteria ?? [],
    priority: input.priority ?? "medium",
    status: "open",
    createdBy: input.createdBy ?? "human",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    resolvedAt: undefined,
    metadata: {}
  };
}

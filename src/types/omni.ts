export type OmniMode =
  | "architect"
  | "reasoning"
  | "coding"
  | "creative"
  | "knowledge"
  | "system-knowledge"
  | "os";

export type MemoryInfluenceLevel = "low" | "medium" | "high";

export interface MemorySettings {
  knowledgeMode?: boolean;
  reasoningMode?: boolean;
  codingMode?: boolean;
  deepKnowledgeMode?: boolean;
  stabilityMode?: boolean;
  source?: string;
}

export interface MemoryState {
  [key: string]: unknown;
  preferredMode?: OmniMode | string;
  tone?: string;
  structure?: string;
  memoryInfluenceLevel?: MemoryInfluenceLevel;
  lastTopics?: string[];
  lastUsedSettings?: MemorySettings;
  updatedAt?: number;
}

export interface RetrievalChunk {
  text: string;
  score?: number;
  source?: string;
}

export interface RetrievalResult {
  selected: RetrievalChunk[];
  cacheSize: number;
  sourcePriority: string[];
}

export interface RouteInfo {
  task: string;
  model: string;
  reason: string;
  escalated?: boolean;
}

export interface ConfidenceInfo {
  score: number;
  band: "low" | "medium" | "high";
  threshold: number;
  escalated: boolean;
}

export interface OmniResponse {
  mode: OmniMode | string;
  route: RouteInfo;
  moduleFile: string;
  retrievalCount: number;
  text: string;
  model: string;
  routeFallback: string | null;
  confidence: ConfidenceInfo;
  reasoning: unknown;
  drift: { drifted: boolean; signal?: string | null };
  sourcePriority: string[];
}

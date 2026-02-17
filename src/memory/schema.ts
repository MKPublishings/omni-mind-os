export interface OmniUserMemory {
  preferredMode?: string;
  lastUsed?: string;
  emotionalTone?: string;
  conversationFingerprint?: string;
}

export interface OmniSystemMemory {
  totalSessions: number;
  lastSessionTime: string;
  modeUsage: Record<string, number>;
}

export interface OmniMemoryBundle {
  user: OmniUserMemory;
  system: OmniSystemMemory;
}
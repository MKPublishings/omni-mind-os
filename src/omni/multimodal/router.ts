export type OmniRouteKind = "chat" | "image" | "memory" | "simulation" | "tool";

export interface ToolDirective {
  name: string;
  input: string;
}

export interface OmniRouteDecision {
  route: OmniRouteKind;
  reason: string;
  confidence: number;
  toolDirective?: ToolDirective;
  signals?: string[];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function extractToolDirective(text: string): ToolDirective | null {
  const match = String(text || "").trim().match(/^\/tool\s+([a-zA-Z0-9_-]+)\s*([\s\S]*)$/i);
  if (!match) return null;

  return {
    name: String(match[1] || "").toLowerCase(),
    input: String(match[2] || "").trim()
  };
}

type RouteScore = {
  route: OmniRouteKind;
  score: number;
        { route: "simulation", score: 0.2, reason: "simulation-intent-detected" }
};

function hasAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function scoreRouteCandidates(text: string, mode: string): { candidates: RouteScore[]; signals: string[] } {
  const lower = String(text || "").toLowerCase();
  const normalizedMode = String(mode || "").toLowerCase();
  const signals: string[] = [];

  const candidates: RouteScore[] = [
    { route: "chat", score: 0.54, reason: "default-chat-path" },
    { route: "image", score: 0.2, reason: "image-intent-detected" },
    { route: "memory", score: 0.2, reason: "memory-intent-detected" },
    { route: "simulation", score: 0.2, reason: "simulation-intent-detected" },
    { route: "tool", score: 0.2, reason: "tool-intent-detected" }
  ];

  if (normalizedMode === "simulation") {
    candidates.find((c) => c.route === "simulation")!.score += 0.55;
    signals.push("mode:simulation");

      // Only trigger memory route if input starts with '/memory'
      if (/^\/memory\b/i.test(lower)) {
        candidates.find((c) => c.route === "memory")!.score += 0.7;
        signals.push("explicit-route:/memory");
      }
    const target = candidates.find((c) => c.route === explicit);
    if (target) {
      target.score += 0.7;
      target.reason = `explicit-route-tag:${explicit}`;
      signals.push(`explicit-route:${explicit}`);
    }
  }

  if (hasAny(lower, [/\b(simulate|simulation mode|run simulation|world sim|state machine)\b/i])) {
    candidates.find((c) => c.route === "simulation")!.score += 0.45;
    signals.push("signal:simulation-keywords");
  }

  if (hasAny(lower, [/\b(memory|remember|recall|what do you know about me|session context|state)\b/i])) {
    candidates.find((c) => c.route === "memory")!.score += 0.42;
    signals.push("signal:memory-keywords");
  }

  if (
    hasAny(lower, [
      /\b(generate image|create image|render image|make an image|visualize this|image prompt|art prompt|portrait of|illustration of|photo of|thumbnail|storyboard frame|concept frame)\b/i
    ])
  ) {
    candidates.find((c) => c.route === "image")!.score += 0.47;
    signals.push("signal:image-keywords");
  }

  if (hasAny(lower, [/^\/tool\b/i, /\b(use tool|call tool|run tool|execute tool)\b/i])) {
    candidates.find((c) => c.route === "tool")!.score += 0.4;
    signals.push("signal:tool-keywords");
  }

  if (lower.length < 8) {
    candidates.find((c) => c.route === "chat")!.score += 0.1;
    signals.push("signal:short-input");
  }

  return { candidates, signals };
}

export function decideMultimodalRoute(params: {
  latestUserText: string;
  mode: string;
}): OmniRouteDecision {
  const text = String(params.latestUserText || "").trim();
  const mode = String(params.mode || "").toLowerCase();

  const toolDirective = extractToolDirective(text);
  if (toolDirective) {
    return {
      route: "tool",
      reason: "explicit-tool-command",
      confidence: 1,
      toolDirective,
      signals: ["explicit-tool-command"]
    };
  }

  const { candidates, signals } = scoreRouteCandidates(text, mode);
  const best = [...candidates].sort((a, b) => b.score - a.score)[0];
  const confidence = clamp(best?.score || 0.5, 0.5, 0.98);

  return {
    route: best?.route || "chat",
    reason: best?.reason || "default-chat-path",
    confidence,
    signals
  };
}

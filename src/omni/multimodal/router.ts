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

export function decideMultimodalRoute(params: {
  latestUserText: string;
  mode: string;
}): OmniRouteDecision {
  const text = String(params.latestUserText || "").trim();
  const lower = text.toLowerCase();
  const mode = String(params.mode || "").toLowerCase();

  const toolDirective = extractToolDirective(text);
  if (toolDirective) {
    return {
      route: "tool",
      reason: "explicit-tool-command",
      confidence: 1,
      toolDirective
    };
  }

  if (mode === "simulation" || /\b(simulate|simulation mode|run simulation|world sim)\b/i.test(lower)) {
    return {
      route: "simulation",
      reason: mode === "simulation" ? "mode-simulation" : "text-simulation-intent",
      confidence: 0.9
    };
  }

  if (/\b(memory|remember|recall|what do you know about me|session context|state)\b/i.test(lower)) {
    return {
      route: "memory",
      reason: "memory-intent-detected",
      confidence: 0.82
    };
  }

  if (
    /\b(generate image|create image|render image|make an image|visualize this|image prompt|art prompt|portrait of|illustration of|photo of)\b/i.test(
      lower
    )
  ) {
    return {
      route: "image",
      reason: "image-intent-detected",
      confidence: 0.87
    };
  }

  return {
    route: "chat",
    reason: "default-chat-path",
    confidence: clamp(text.length > 0 ? 0.74 : 0.5, 0.5, 0.95)
  };
}

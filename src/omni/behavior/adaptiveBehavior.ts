export interface AdaptiveBehaviorInput {
  mode: string;
  userEmotion: string;
  omniTone: string;
  route: string;
}

function normalizeText(value: unknown): string {
  return String(value || "").trim();
}

export function buildAdaptiveBehaviorPrompt(input: AdaptiveBehaviorInput): string {
  return [
    "Adaptive Behavior Layer is active.",
    `Mode context: ${normalizeText(input.mode) || "auto"}`,
    `User emotion: ${normalizeText(input.userEmotion) || "neutral"}`,
    `Omni tone target: ${normalizeText(input.omniTone) || "steady-neutral"}`,
    `Active route: ${normalizeText(input.route) || "chat"}`,
    "Adjust pacing and explanation depth to maintain clarity and emotional stability."
  ].join("\n");
}

export function applyAdaptiveBehavior(text: string, input: AdaptiveBehaviorInput): string {
  const base = normalizeText(text);
  if (!base) return "";

  const mode = normalizeText(input.mode).toLowerCase();
  const emotion = normalizeText(input.userEmotion).toLowerCase();
  const route = normalizeText(input.route).toLowerCase();

  let prefix = "";
  let suffix = "";

  if (emotion === "frustrated") {
    prefix = "Stabilizing tone: I understand the friction. Here is the cleanest path forward.\n\n";
    suffix = "\n\nIf this still fails, share the exact error and I will pivot immediately.";
  } else if (emotion === "confused") {
    prefix = "Clarity mode: I will keep this concrete and stepwise.\n\n";
    suffix = "\n\nIf any step is unclear, say 'expand step N' and I will zoom in.";
  } else if (emotion === "positive") {
    prefix = "Momentum acknowledged.\n\n";
  }

  if (route === "tool") {
    return `${prefix}${base}${suffix}`.trim();
  }

  if (mode === "coding" || mode === "os") {
    const codingScaffold = emotion === "confused" || emotion === "frustrated"
      ? "\n\nExecution checklist:\n1) run\n2) verify\n3) fallback"
      : "";
    return `${prefix}${base}${codingScaffold}${suffix}`.trim();
  }

  if (mode === "creative" || mode === "lore") {
    const creativeScaffold = emotion === "confused"
      ? "\n\nCreative map: premise → motif → style → output."
      : "";
    return `${prefix}${base}${creativeScaffold}${suffix}`.trim();
  }

  return `${prefix}${base}${suffix}`.trim();
}

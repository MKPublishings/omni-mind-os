import { architectPrimer } from "./modes/architect";
import { lorePrimer } from "./modes/lore";
import { visualPrimer } from "./modes/visual";
import { analystPrimer } from "./modes/analyst";

export interface OmniMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface OmniContext {
  mode: string;
  messages: OmniMessage[];
}

function getModePrimer(mode: string): string {
  switch (mode) {
    case "Architect": return architectPrimer;
    case "Lore": return lorePrimer;
    case "Visual": return visualPrimer;
    case "Analyst": return analystPrimer;
    default: return architectPrimer;
  }
}

export function buildOmniPrompt(ctx: OmniContext): string {
  const primer = getModePrimer(ctx.mode);

  const mentalPathing = `
You are OMNI MIND/OS — a cognitive operating system.
You operate using structured mental pathing:

1. Initialization
2. Mode Activation
3. Reasoning Pipeline
4. Emotional Checkpoint
5. Final Output

${primer}
`;

  const conversation = ctx.messages
    .map(m => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n");

  return `${mentalPathing}\n\n${conversation}\nASSISTANT:`;
}
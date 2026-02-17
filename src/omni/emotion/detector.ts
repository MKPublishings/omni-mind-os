export function detectEmotion(text: string): string {
  const lower = text.toLowerCase();

  if (lower.includes("sorry") || lower.includes("apologize")) return "apologetic";
  if (lower.includes("angry") || lower.includes("frustrated")) return "frustrated";
  if (lower.includes("happy") || lower.includes("glad")) return "positive";
  if (lower.includes("confused") || lower.includes("unclear")) return "confused";

  return "neutral";
}
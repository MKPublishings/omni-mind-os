export function scoreOutput(text: string): number {
  let score = 100;

  if (text.length < 20) score -= 20;
  if (text.includes("I am an AI")) score -= 40;
  if (text.includes("cannot")) score -= 10;

  return Math.max(0, score);
}
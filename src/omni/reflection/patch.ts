import { scoreOutput } from "./score";
import { reviewOutput } from "./review";

export function reflectAndPatch(text: string): string {
  const score = scoreOutput(text);

  if (score < 70) {
    return reviewOutput(text);
  }

  return text;
}
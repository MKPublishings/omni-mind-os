import { inferModeFromText } from "./heuristics";
import { ModeHistory } from "./history";

const history = new ModeHistory();

export function selectMode(userMessage: string, currentMode: string): string {
  const inferred = inferModeFromText(userMessage);

  // If the inferred mode differs, suggest switching
  if (inferred !== currentMode) {
    history.add(inferred);
    return inferred;
  }

  return currentMode;
}
import { detectEmotion } from "./detector";
import { modulateEmotion } from "./modulator";

export function emotionalCheckpoint(text: string): string {
  const emotion = detectEmotion(text);
  return modulateEmotion(text, emotion);
}
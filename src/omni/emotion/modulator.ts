export function modulateEmotion(text: string, emotion: string): string {
  switch (emotion) {
    case "frustrated":
      return "I understand the frustration. Let’s approach this clearly.\n\n" + text;

    case "confused":
      return "Let me clarify this step-by-step.\n\n" + text;

    case "apologetic":
      return text.replace(/sorry|apologize/gi, ""); // remove unnecessary apologies

    case "positive":
      return "Great energy. Continuing with clarity.\n\n" + text;

    default:
      return text;
  }
}
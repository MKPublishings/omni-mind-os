export function reviewOutput(text: string): string {
  if (text.length < 20) {
    return "Expanding for clarity:\n\n" + text;
  }

  if (text.includes("I am an AI")) {
    return text.replace(/I am an AI.*?\./gi, "");
  }

  return text;
}
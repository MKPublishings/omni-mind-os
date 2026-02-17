export function inferModeFromText(text: string): string {
  const lower = text.toLowerCase();

  if (lower.includes("explain") || lower.includes("break down"))
    return "Analyst";

  if (lower.includes("story") || lower.includes("world") || lower.includes("character"))
    return "Lore";

  if (lower.includes("visualize") || lower.includes("image") || lower.includes("scene"))
    return "Visual";

  if (lower.includes("build") || lower.includes("design") || lower.includes("architecture"))
    return "Architect";

  return "Architect";
}
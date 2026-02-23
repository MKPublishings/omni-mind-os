export function cleanText(value) {
  return String(value || "")
    .replace(/<script.*?>.*?<\/script>/gi, "")
    .replace(/\r\n/g, "\n")
    .trim();
}

export function normalizeWhitespace(value) {
  return cleanText(value).replace(/\s+/g, " ").trim();
}

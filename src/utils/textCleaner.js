// @ts-check

/** @param {string} value */
export function cleanText(value) {
  return String(value || "")
    .replace(/<script.*?>.*?<\/script>/gi, "")
    .replace(/\r\n/g, "\n")
    .trim();
}

/** @param {string} value */
export function normalizeWhitespace(value) {
  return cleanText(value).replace(/\s+/g, " ").trim();
}

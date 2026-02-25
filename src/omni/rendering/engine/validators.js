import { listAvailableStyles, resolveStyleName } from "../styles/styleRegistry.js";

/**
 * @param {string} styleName
 * @returns {string}
 */
export function sanitizeStyleInput(styleName) {
  return String(styleName || "").trim().toLowerCase();
}

/**
 * @param {string} styleName
 * @returns {boolean}
 */
export function isKnownStyle(styleName) {
  return Boolean(resolveStyleName(styleName));
}

/**
 * @param {string} styleName
 * @param {string} [fallback=""]
 * @returns {string}
 */
export function normalizeStyleOrFallback(styleName, fallback = "") {
  const normalized = resolveStyleName(sanitizeStyleInput(styleName));
  return normalized || sanitizeStyleInput(fallback) || "";
}

/**
 * @param {string} prompt
 * @returns {string}
 */
export function sanitizeUserPrompt(prompt) {
  return String(prompt || "")
    .replace(/[\x00-\x1F\x7F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * @param {string} prompt
 * @returns {{ valid: boolean; cleaned: string; maxRecommendedLength: number; availableStyles: string[] }}
 */
export function validatePromptShape(prompt) {
  const cleaned = sanitizeUserPrompt(prompt);
  return {
    valid: cleaned.length > 0,
    cleaned,
    maxRecommendedLength: 4000,
    availableStyles: listAvailableStyles()
  };
}

import { applyStyle } from "./styleSwitcher.js";

/**
 * @param {string} userPrompt
 * @param {string} styleName
 * @returns {string}
 */
export function assemblePrompt(userPrompt, styleName) {
  const styleBlock = applyStyle(styleName);

  return `
${styleBlock}

User Prompt:
${String(userPrompt || "").trim()}
  `;
}

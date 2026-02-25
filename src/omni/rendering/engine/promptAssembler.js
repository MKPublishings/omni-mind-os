import { applyStyle } from "./styleSwitcher.js";

/**
 * @param {string} userPrompt
 * @param {string} styleName
 * @param {{ camera?: string; lighting?: string; materials?: string[] }} [options={}]
 * @returns {string}
 */
export function assemblePrompt(userPrompt, styleName, options = {}) {
  const styleBlock = applyStyle(styleName, userPrompt, options);

  return `
${styleBlock}

User Prompt:
${String(userPrompt || "").trim()}
  `;
}

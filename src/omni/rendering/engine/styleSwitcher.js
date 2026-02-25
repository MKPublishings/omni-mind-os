import { getStylePack, resolveStyleName } from "../styles/styleRegistry.js";
import { BASE_STYLE_RECOGNITION } from "../styles/baseStyles.js";

/**
 * @param {string} styleName
 * @returns {string}
 */
export function applyStyle(styleName) {
  const normalizedStyle = resolveStyleName(styleName);
  const stylePack = getStylePack(normalizedStyle);
  const selectedStyle = normalizedStyle || "auto";

  return `
${BASE_STYLE_RECOGNITION}

Selected Style: ${selectedStyle}
${stylePack}
  `;
}

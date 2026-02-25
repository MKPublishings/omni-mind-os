import { getStylePack, resolveStyleName } from "../styles/styleRegistry.js";
import { BASE_STYLE_RECOGNITION } from "../styles/baseStyles.js";
import { assembleHyperRealPrompt } from "../hyperreal/hyperrealAssembler.js";

/**
 * @param {string} styleName
 * @param {string} [userPrompt=""]
 * @param {{ camera?: string; lighting?: string; materials?: string[] }} [options={}]
 * @returns {string}
 */
export function applyStyle(styleName, userPrompt = "", options = {}) {
  const normalizedStyle = resolveStyleName(styleName);

  if (normalizedStyle === "hyper-real") {
    return assembleHyperRealPrompt(
      userPrompt,
      String(options.camera || "portrait-85mm"),
      String(options.lighting || "studio-soft"),
      Array.isArray(options.materials) ? options.materials : ["skin"]
    );
  }

  const stylePack = getStylePack(normalizedStyle);
  const selectedStyle = normalizedStyle || "auto";

  return `
${BASE_STYLE_RECOGNITION}

Selected Style: ${selectedStyle}
${stylePack}
  `;
}

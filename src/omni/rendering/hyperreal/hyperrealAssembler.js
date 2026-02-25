import { HYPERREAL_STYLE } from "./hyperrealPack.js";
import { CAMERA_PROFILES } from "./cameraProfiles.js";
import { LIGHTING_PROFILES } from "./lightingProfiles.js";
import { MATERIAL_PROFILES } from "./materialProfiles.js";

/** @type {Record<string, string>} */
const CAMERA_PROFILE_MAP = CAMERA_PROFILES;
/** @type {Record<string, string>} */
const LIGHTING_PROFILE_MAP = LIGHTING_PROFILES;
/** @type {Record<string, string>} */
const MATERIAL_PROFILE_MAP = MATERIAL_PROFILES;

/**
 * @param {string[]} materials
 * @returns {string}
 */
function buildMaterialBlock(materials) {
  return materials
    .map((m) => MATERIAL_PROFILE_MAP[String(m || "").trim().toLowerCase()] || "")
    .filter(Boolean)
    .join("\n");
}

/**
 * @param {string} userPrompt
 * @param {string} camera
 * @param {string} lighting
 * @param {string[]} [materials=[]]
 * @returns {string}
 */
export function assembleHyperRealPrompt(userPrompt, camera, lighting, materials = []) {
  const cameraKey = String(camera || "portrait-85mm").trim().toLowerCase();
  const lightingKey = String(lighting || "studio-soft").trim().toLowerCase();
  const normalizedMaterials = Array.isArray(materials) ? materials : [];

  const cameraBlock = CAMERA_PROFILE_MAP[cameraKey] || CAMERA_PROFILE_MAP["portrait-85mm"];
  const lightingBlock = LIGHTING_PROFILE_MAP[lightingKey] || LIGHTING_PROFILE_MAP["studio-soft"];
  const materialBlock = buildMaterialBlock(normalizedMaterials);

  return `
${HYPERREAL_STYLE}

Camera:
${cameraBlock}

Lighting:
${lightingBlock}

Materials:
${materialBlock}

User Prompt:
${String(userPrompt || "").trim()}
  `;
}

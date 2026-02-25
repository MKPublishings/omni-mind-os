import { STYLE_PACKS } from "./stylePacks.js";

/** @type {Record<string, string>} */
const STYLE_PACK_MAP = STYLE_PACKS;

/** @type {Record<string, string>} */
const STYLE_ALIASES = {
  mythic_cinematic: "vfx",
  os_cinematic: "3d",
  noir_tech: "vfx",
  hyperreal: "hyper-real",
  "hyper-realistic": "hyper-real",
  photoreal: "hyper-real",
  "photo-real": "hyper-real"
};

/**
 * @param {string} styleName
 * @returns {string}
 */
function normalizeStyleName(styleName) {
  const raw = String(styleName || "").toLowerCase().trim();
  if (!raw) return "";
  return STYLE_ALIASES[raw] || raw;
}

/**
 * @param {string} styleName
 * @returns {string}
 */
export function getStylePack(styleName) {
  const key = normalizeStyleName(styleName);
  return STYLE_PACK_MAP[key] || "";
}

/**
 * @param {string} styleName
 * @returns {string}
 */
export function resolveStyleName(styleName) {
  const key = normalizeStyleName(styleName);
  return STYLE_PACK_MAP[key] ? key : "";
}

export function listAvailableStyles() {
  return Object.keys(STYLE_PACKS);
}

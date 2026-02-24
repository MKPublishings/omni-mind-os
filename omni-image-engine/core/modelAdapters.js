const fs = require("fs");
const path = require("path");

const MODEL_CONFIG_PATH = path.join(__dirname, "..", "config", "modelConfig.json");

function loadModelConfig() {
  const raw = fs.readFileSync(MODEL_CONFIG_PATH, "utf8");
  return JSON.parse(raw);
}

function normalizeTag(tag) {
  return String(tag || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
}

function toSlizzaiSyntax(payload) {
  const safeTechnical = (payload.technicalTags || []).map(normalizeTag);
  const safeStyle = (payload.styleTags || []).map(normalizeTag);
  const safeNegative = (payload.negativeTags || []).map(normalizeTag);

  const finalPrompt = [
    payload.semanticExpansion,
    ...safeTechnical,
    ...safeStyle,
    `--neg ${safeNegative.join(",")}`
  ]
    .filter(Boolean)
    .join(" | ");

  return {
    ...payload,
    adapterTarget: "slizzai-imagegen-v2.1",
    finalPrompt
  };
}

function toGenericSyntax(payload, targetModel) {
  const supported = loadModelConfig()?.models?.[targetModel]?.supportedTags || [];
  const supportsAll = supported.includes("*");

  const technicalTags = (payload.technicalTags || []).filter((tag) => {
    if (supportsAll) return true;
    const key = normalizeTag(tag);
    return supported.includes(key);
  });

  const styleTags = (payload.styleTags || []).filter((tag) => {
    if (supportsAll) return true;
    const key = normalizeTag(tag);
    return supported.includes(key);
  });

  return {
    ...payload,
    adapterTarget: targetModel,
    technicalTags,
    styleTags,
    finalPrompt: [
      payload.semanticExpansion,
      ...technicalTags,
      ...styleTags,
      `negative prompt: ${(payload.negativeTags || []).join(", ")}`
    ]
      .filter(Boolean)
      .join(", ")
  };
}

function applyModelAdapter(payload, targetModel = "slizzai-imagegen-v2.1") {
  if (targetModel === "slizzai-imagegen-v2.1") {
    return toSlizzaiSyntax(payload);
  }
  return toGenericSyntax(payload, targetModel);
}

function toSlizzai(payload) {
  return toSlizzaiSyntax(payload).finalPrompt;
}

module.exports = {
  applyModelAdapter,
  toSlizzai,
  loadModelConfig
};

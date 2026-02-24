const fs = require("fs");
const path = require("path");
const { applyModelAdapter } = require("./modelAdapters");

const QUALITY_PATH = path.join(__dirname, "..", "config", "qualityTags.json");
const NEGATIVE_PATH = path.join(__dirname, "..", "config", "negativeTags.json");

function loadQualityTags(level = "ultra") {
  const raw = fs.readFileSync(QUALITY_PATH, "utf8");
  const json = JSON.parse(raw);
  return json?.levels?.[level] || json?.levels?.ultra || [];
}

function loadNegativeTags() {
  const raw = fs.readFileSync(NEGATIVE_PATH, "utf8");
  const json = JSON.parse(raw);
  return json?.negativeTags || [];
}

function semanticPass(orchestrated) {
  const expanded = [
    orchestrated.semanticExpansion,
    "Environmental logic is physically coherent and cinematic.",
    "Emotion should be visible in posture, gaze, and atmosphere."
  ].join(" ");

  return {
    ...orchestrated,
    semanticExpansion: expanded
  };
}

function technicalPass(orchestrated, qualityLevel) {
  const qualityTags = loadQualityTags(qualityLevel);
  return {
    ...orchestrated,
    technicalTags: [...new Set([...(orchestrated.technicalTags || []), ...qualityTags])]
  };
}

function negativePass(orchestrated) {
  const negativeTags = loadNegativeTags();
  return {
    ...orchestrated,
    negativeTags: [...new Set([...(orchestrated.negativeTags || []), ...negativeTags])]
  };
}

function rebuildFinalPrompt(orchestrated) {
  const finalPrompt = [
    orchestrated.semanticExpansion,
    ...(orchestrated.technicalTags || []),
    ...(orchestrated.styleTags || []),
    ...(orchestrated.negativeTags || []).map((tag) => `negative:${tag}`)
  ].join(", ");

  return {
    ...orchestrated,
    finalPrompt
  };
}

function refinePrompt(orchestrated, opts = {}) {
  const qualityLevel = opts.qualityLevel || "ultra";
  const targetModel = opts.targetModel || "slizzai-imagegen-v2.1";

  const pass1 = semanticPass(orchestrated);
  const pass2 = technicalPass(pass1, qualityLevel);
  const pass3 = negativePass(pass2);
  const pass4 = applyModelAdapter(rebuildFinalPrompt(pass3), targetModel);

  return {
    pass1,
    pass2,
    pass3,
    pass4,
    final: pass4
  };
}

module.exports = {
  refinePrompt
};

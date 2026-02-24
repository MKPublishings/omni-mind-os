const { getStylePack } = require("./stylePacks");
const { getNegativeTags } = require("./negativePrompting");

function clean(text) {
  return String(text || "")
    .replace(/[\x00-\x1F\x7F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractSegments(prompt) {
  const value = clean(prompt);
  const lower = value.toLowerCase();

  const environmentHints = ["ocean", "forest", "city", "desert", "mountain", "space", "garden", "temple", "room"];
  const lightingHints = ["sunset", "moonlight", "neon", "volumetric", "studio light", "backlight", "rim light"];
  const moodHints = ["mythic", "calm", "dramatic", "melancholic", "dark", "vibrant", "heroic", "ethereal"];
  const cameraHints = ["portrait", "wide shot", "close-up", "cinematic", "35mm", "85mm", "low angle", "top-down"];

  const environment = environmentHints.find((item) => lower.includes(item)) || "cinematic environment";
  const lighting = lightingHints.filter((item) => lower.includes(item));
  const mood = moodHints.filter((item) => lower.includes(item));
  const camera = cameraHints.filter((item) => lower.includes(item));

  const subject = value.split(/,| in | with | under /i)[0] || value;

  return {
    subject: clean(subject),
    environment,
    lighting: lighting.length ? lighting : ["volumetric rim lighting"],
    mood: mood.length ? mood : ["mythic cinematic tone"],
    camera: camera.length ? camera : ["cinematic framing"]
  };
}

function toFinalPrompt(parts) {
  const all = [
    parts.semanticExpansion,
    ...parts.technicalTags,
    ...parts.styleTags,
    ...parts.negativeTags.map((tag) => `negative:${tag}`)
  ];

  return all.filter(Boolean).join(", ");
}

function orchestratePrompt({
  userPrompt,
  styleName = "OS-Cinematic",
  dialect = "mythic-cinematic",
  qualityLevel = "ultra",
  manualOverrides = {}
}) {
  const parsed = extractSegments(userPrompt);
  const stylePack = getStylePack(styleName);
  const negativeTags = getNegativeTags();

  const semanticExpansion = [
    `Subject: ${parsed.subject}`,
    `Environment: ${parsed.environment}`,
    `Mood: ${parsed.mood.join(" + ")}`,
    `Lighting: ${parsed.lighting.join(" + ")}`,
    `Camera: ${parsed.camera.join(" + ")}`,
    `Dialect: ${dialect}`
  ].join(". ");

  const technicalTags = [
    "high detail composition",
    "cinematic color grading",
    "depth-aware scene structure",
    `quality:${qualityLevel}`
  ];

  const styleTags = [
    ...(stylePack.lightingRules || []),
    ...(stylePack.colorRules || []),
    ...(stylePack.compositionRules || []),
    ...(stylePack.textureRules || []),
    ...(stylePack.emotionalSignatures || [])
  ];

  const output = {
    userPrompt: clean(userPrompt),
    semanticExpansion,
    technicalTags,
    styleTags,
    negativeTags,
    finalPrompt: ""
  };

  const merged = {
    ...output,
    ...manualOverrides,
    technicalTags: [...output.technicalTags, ...(manualOverrides.technicalTags || [])],
    styleTags: [...output.styleTags, ...(manualOverrides.styleTags || [])],
    negativeTags: [...output.negativeTags, ...(manualOverrides.negativeTags || [])]
  };

  merged.finalPrompt = toFinalPrompt(merged);
  return merged;
}

module.exports = {
  orchestratePrompt,
  extractSegments
};

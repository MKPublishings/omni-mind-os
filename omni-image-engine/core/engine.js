const { orchestratePrompt } = require("./promptOrchestrator");
const { refinePrompt } = require("./multiPassRefiner");
const { toSlizzai } = require("./modelAdapters");

function buildOmniImagePrompt({
  prompt,
  styleName = "OS-Cinematic",
  dialect = "mythic-cinematic",
  qualityLevel = "ultra",
  targetModel = "slizzai-imagegen-v2.1",
  manualOverrides = {}
}) {
  const orchestrated = orchestratePrompt({
    userPrompt: prompt,
    styleName,
    dialect,
    qualityLevel,
    manualOverrides
  });

  const refined = refinePrompt(orchestrated, {
    qualityLevel,
    targetModel
  });

  const finalPrompt = targetModel === "slizzai-imagegen-v2.1"
    ? toSlizzai(refined.final)
    : refined.final.finalPrompt;

  return {
    orchestrated,
    refined,
    finalPrompt
  };
}

module.exports = {
  buildOmniImagePrompt
};

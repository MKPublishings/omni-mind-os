function buildArchitectModePayload({
  userPrompt,
  lighting,
  camera,
  stylePack,
  qualityLevel,
  negativeTags,
  overrides = {}
}) {
  return {
    mode: "architect",
    userPrompt,
    controls: {
      lighting: lighting || "auto",
      camera: camera || "auto",
      stylePack: stylePack || "OS-Cinematic",
      qualityLevel: qualityLevel || "ultra",
      negativeTags: negativeTags || []
    },
    overrides
  };
}

module.exports = {
  buildArchitectModePayload
};

function buildSimpleModePayload(userPrompt) {
  return {
    mode: "simple",
    userPrompt,
    options: {
      autoOrchestration: true,
      exposeControls: false
    }
  };
}

module.exports = {
  buildSimpleModePayload
};

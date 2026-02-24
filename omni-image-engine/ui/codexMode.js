function buildCodexView({ userPrompt, pass1, pass2, pass3, pass4 }) {
  return {
    mode: "codex",
    userPrompt,
    semanticExpansion: pass1?.semanticExpansion || "",
    technicalTags: pass2?.technicalTags || [],
    styleTags: pass2?.styleTags || [],
    negativeTags: pass3?.negativeTags || [],
    finalPrompt: pass4?.finalPrompt || ""
  };
}

module.exports = {
  buildCodexView
};

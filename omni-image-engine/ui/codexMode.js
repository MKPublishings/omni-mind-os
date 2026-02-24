const { omniImageGenerate } = require("../index");

async function codexMode(prompt, options = {}) {
    const result = await omniImageGenerate(prompt, { ...options, mode: "codex" });

    return {
        userPrompt: result.orchestrated.userPrompt,
        semanticExpansion: result.orchestrated.semanticExpansion,
        technicalTags: result.refined.technicalTags,
        styleTags: result.refined.styleTags,
        negativeTags: result.refined.negativeTags,
        finalPrompt: result.refined.finalPrompt,
        filePath: result.filePath
    };
}

module.exports = codexMode;

const stylePacks = require("./stylePacks");
const visualIntelligence = require("./visualIntelligence");
const tokenizer = require("../utils/tokenizer");
const logger = require("../utils/logger");

module.exports = function promptOrchestrator(userPrompt, options = {}) {
    const tokens = tokenizer(userPrompt);

    const base = {
        userPrompt,
        tokens,
        semanticExpansion: "",
        technicalTags: [],
        styleTags: [],
        negativeTags: [],
        finalPrompt: ""
    };

    const sceneInsights = visualIntelligence.inferScene(userPrompt);
    const stylePackName = options.stylePack || "mythic_cinematic";
    const stylePack = stylePacks.getStylePack(stylePackName);

    const semanticExpansion = [
        userPrompt,
        sceneInsights.description
    ].join(", ");

    const styleTags = stylePack.tags || [];
    const technicalTags = [];

    const finalPrompt = [
        semanticExpansion,
        styleTags.join(", "),
        technicalTags.join(", ")
    ].filter(Boolean).join(", ");

    const orchestrated = {
        ...base,
        semanticExpansion,
        technicalTags,
        styleTags,
        negativeTags: [],
        finalPrompt
    };

    logger.info("Orchestrated prompt:", orchestrated.finalPrompt);
    return orchestrated;
};

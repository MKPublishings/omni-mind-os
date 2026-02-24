const negativePrompting = require("./negativePrompting");
const sceneEnforcer = require("./sceneEnforcer");
const applyFreshness = require("./promptFreshness");
const logger = require("../utils/logger");
const qualityConfig = require("../config/qualityTags.json");

function semanticExpansionPass(data) {
    // Already expanded in orchestrator; extend here if needed
    return data;
}

function technicalEnhancementPass(data, qualityLevel) {
    const level = qualityLevel || "default";
    const tags = qualityConfig[level] || qualityConfig["default"] || [];
    data.technicalTags = [...data.technicalTags, ...tags];
    return data;
}

module.exports = function multiPassRefiner(promptData, options = {}) {
    let data = { ...promptData };

    // Pass 1: semantic expansion
    data = semanticExpansionPass(data);

    // Pass 2: technical enhancement
    data = technicalEnhancementPass(data, options.quality);

    // Pass 3: negative prompting
    data = negativePrompting(data);

    // Pass 4: scene enforcement
    data = sceneEnforcer(data);

    // Build final prompt string
    const finalPrompt = [
        data.semanticExpansion,
        data.styleTags.join(", "),
        data.technicalTags.join(", ")
    ].filter(Boolean).join(", ");

    data.finalPrompt = finalPrompt;

    // Freshness options (seed, etc.)
    const finalOptions = applyFreshness(options);

    logger.info("Final refined prompt:", data.finalPrompt);
    return { data, finalOptions };
};

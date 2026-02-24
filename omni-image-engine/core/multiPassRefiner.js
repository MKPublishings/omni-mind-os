const negativePrompting = require("./negativePrompting");
const modelAdapters = require("./modelAdapters");
const sceneEnforcer = require("./sceneEnforcer");
const applyFreshness = require("./promptFreshness");
const logger = require("../utils/logger");

function semanticExpansionPass(data) {
    return data;
}

function technicalEnhancementPass(data, qualityTags) {
    const tags = qualityTags || [];
    data.technicalTags = [...data.technicalTags, ...tags];
    return data;
}

module.exports = function multiPassRefiner(promptData, options = {}) {
    let data = { ...promptData };

    data = semanticExpansionPass(data);

    const qualityTags = require("../config/qualityTags.json").default || [];
    data = technicalEnhancementPass(data, qualityTags);

    data = negativePrompting(data);

    data = sceneEnforcer(data);

    data = modelAdapters.toSlizzai(data);

    const finalOptions = applyFreshness(options);

    logger.info("Final refined prompt:", data.finalPrompt);
    return { data, finalOptions };
};

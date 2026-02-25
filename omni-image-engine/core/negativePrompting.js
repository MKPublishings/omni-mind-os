const negativeConfig = require("../config/negativeTags.json");
const logger = require("../utils/logger");

module.exports = function negativePrompting(promptData) {
    const userPrompt = String(promptData?.userPrompt || "").toLowerCase();
    const negativeTags = [...(promptData.negativeTags || [])];

    // Base negatives
    negativeTags.push(...(Array.isArray(negativeConfig.base) ? negativeConfig.base : []));

    // Conditional environment suppression
    if (!userPrompt.includes("ocean") && !userPrompt.includes("sea") && !userPrompt.includes("beach")) {
        negativeTags.push(...(Array.isArray(negativeConfig.noOcean) ? negativeConfig.noOcean : []));
    }

    promptData.negativeTags = [...new Set(negativeTags)];

    logger.info("Negative tags applied:", promptData.negativeTags);
    return promptData;
};

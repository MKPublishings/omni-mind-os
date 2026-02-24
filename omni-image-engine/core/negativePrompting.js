const negativeConfig = require("../config/negativeTags.json");
const logger = require("../utils/logger");

module.exports = function negativePrompting(promptData) {
    const userPrompt = promptData.userPrompt.toLowerCase();
    const negativeTags = [...(promptData.negativeTags || [])];

    // Base negatives
    negativeTags.push(...negativeConfig.base);

    // Conditional moon/ocean suppression
    if (!userPrompt.includes("moon")) {
        negativeTags.push(...negativeConfig.noMoon);
    }
    if (!userPrompt.includes("ocean") && !userPrompt.includes("sea") && !userPrompt.includes("beach")) {
        negativeTags.push(...negativeConfig.noOcean);
    }

    promptData.negativeTags = negativeTags;

    logger.info("Negative tags applied:", negativeTags);
    return promptData;
};

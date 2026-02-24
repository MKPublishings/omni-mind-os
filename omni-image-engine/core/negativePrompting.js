const negativeConfig = require("../config/negativeTags.json");
const logger = require("../utils/logger");

module.exports = function negativePrompting(promptData) {
    const userPrompt = promptData.userPrompt.toLowerCase();
    const negativeTags = [...(promptData.negativeTags || [])];

    negativeTags.push(...negativeConfig.base);

    if (!userPrompt.includes("moon")) {
        negativeTags.push(...negativeConfig.noMoon);
    }
    if (!userPrompt.includes("ocean") && !userPrompt.includes("sea") && !userPrompt.includes("beach")) {
        negativeTags.push(...negativeConfig.noOcean);
    }

    promptData.negativeTags = negativeTags;

    const finalPrompt = [
        promptData.finalPrompt,
        negativeTags.length ? `negative: ${negativeTags.join(", ")}` : ""
    ].filter(Boolean).join(", ");

    promptData.finalPrompt = finalPrompt;

    logger.info("Negative tags applied:", negativeTags);
    return promptData;
};

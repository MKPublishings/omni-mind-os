const extractEnvironment = require("../utils/extractEnvironment");
const logger = require("../utils/logger");

module.exports = function sceneEnforcer(promptData) {
    const envKeywords = extractEnvironment(promptData.userPrompt);

    if (!envKeywords.length) {
        logger.info("No explicit environment found; allowing model freedom.");
        return promptData;
    }

    const envString = `environment: ${envKeywords.join(", ")}`;
    promptData.finalPrompt = [
        promptData.finalPrompt,
        envString
    ].filter(Boolean).join(", ");

    logger.info("Scene enforced with environment:", envKeywords);
    return promptData;
};

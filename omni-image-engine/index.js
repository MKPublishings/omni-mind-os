const omniImageGenerator = require("./core/omniImageGenerator");
const logger = require("./utils/logger");
const { ensureString } = require("./utils/validator");

async function omniImageGenerate(userPrompt, options = {}) {
    const normalizedPrompt = ensureString(userPrompt).trim();
    if (!normalizedPrompt) {
        throw new Error("Image generation requires a non-empty prompt string");
    }

    logger.info("User prompt:", normalizedPrompt);

    const result = await omniImageGenerator.generate(normalizedPrompt, options);

    logger.info("Generation complete. File:", result.filePath);
    return result;
}

module.exports = {
    omniImageGenerate
};

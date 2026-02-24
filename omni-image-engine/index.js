const omniImageGenerator = require("./core/omniImageGenerator");
const logger = require("./utils/logger");

async function omniImageGenerate(userPrompt, options = {}) {
    logger.info("User prompt:", userPrompt);

    const result = await omniImageGenerator.generate(userPrompt, options);

    logger.info("Generation complete. File:", result.filePath);
    return result;
}

module.exports = {
    omniImageGenerate
};

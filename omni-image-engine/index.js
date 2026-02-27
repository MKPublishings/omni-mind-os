const omniImageGenerator = require("./core/omniImageGenerator");
const videoEngine = require("./video");
const { Laws } = require("./core/lawRegistry");
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

async function omniVideoGenerate(userPrompt, mode = "balanced", options = {}) {
    const normalizedPrompt = ensureString(userPrompt).trim();
    if (!normalizedPrompt) {
        throw new Error("Video generation requires a non-empty prompt string");
    }

    logger.info("Video prompt:", normalizedPrompt);
    const result = await videoEngine.generateVideoClip(normalizedPrompt, mode, options, omniImageGenerator.generate);
    logger.info("Video manifest created:", result.output.filePath);
    return result;
}

module.exports = {
    omniImageGenerate,
    omniVideoGenerate,
    Laws
};

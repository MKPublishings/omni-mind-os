const promptOrchestrator = require("./promptOrchestrator");
const multiPassRefiner = require("./multiPassRefiner");
const modelRouter = require("./modelRouter");
const fileExporter = require("../io/fileExporter");
const logger = require("../utils/logger");

async function generate(userPrompt, options = {}) {
    const orchestrated = promptOrchestrator(userPrompt, options);
    const { data, finalOptions } = multiPassRefiner(orchestrated, options);

    // Call the underlying model (you plug in your provider here)
    const generationOptions = {
        ...finalOptions,
        negativePrompt: Array.isArray(data.negativeTags) ? data.negativeTags.join(", ") : ""
    };

    const imageBuffer = await modelRouter.generateImage(data.finalPrompt, generationOptions);

    // Export to disk with omni_image_(date&time).ext
    const filePath = await fileExporter.exportImageWithMeta(imageBuffer, generationOptions);

    return {
        userPrompt,
        orchestrated,
        refined: data,
        options: finalOptions,
        filePath
    };
}

module.exports = {
    generate
};

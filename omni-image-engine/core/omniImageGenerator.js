const promptOrchestrator = require("./promptOrchestrator");
const multiPassRefiner = require("./multiPassRefiner");
const modelRouter = require("./modelRouter");
const fileExporter = require("../io/fileExporter");
const logger = require("../utils/logger");

const STILL_MODE_NEGATIVE_TERMS = [
    "motion",
    "animation",
    "video",
    "frames",
    "sequence",
    "gif",
    "moving camera",
    "camera pan",
    "camera movement",
    "frame interpolation"
];

function normalizeGenerationMode(options = {}) {
    const mode = String(options.generation_mode || options.generationMode || "image").toLowerCase();
    if (mode === "video" || mode === "video-keyframe") {
        return "video";
    }
    return "image";
}

async function generate(userPrompt, options = {}) {
    const generationMode = normalizeGenerationMode(options);
    const orchestrated = promptOrchestrator(userPrompt, {
        ...options,
        generation_mode: generationMode
    });
    const { data, finalOptions } = multiPassRefiner(orchestrated, options);

    if (generationMode === "image") {
        data.negativeTags = [...new Set([...(data.negativeTags || []), ...STILL_MODE_NEGATIVE_TERMS])];
    }

    // Call the underlying model (you plug in your provider here)
    const generationOptions = {
        ...finalOptions,
        generation_mode: generationMode,
        disableTemporal: generationMode === "image",
        negativePrompt: Array.isArray(data.negativeTags) ? data.negativeTags.join(", ") : ""
    };

    const imageBuffer = await modelRouter.generateImage(data.finalPrompt, generationOptions);

    // Export to disk with omni_image_(date&time).ext
    const filePath = await fileExporter.exportImageWithMeta(imageBuffer, generationOptions);

    return {
        userPrompt,
        generationMode,
        orchestrated,
        refined: data,
        options: finalOptions,
        filePath
    };
}

module.exports = {
    generate
};

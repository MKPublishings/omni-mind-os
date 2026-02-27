const config = require("./config/videoConfig.json");
const { ensureString } = require("../utils/validator");

function ensureNumber(value, fallback) {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function normalizeDialogue(dialogue) {
    if (!Array.isArray(dialogue)) return [];
    return dialogue
        .map((line, index) => {
            const text = ensureString(line && line.text).trim();
            if (!text) return null;
            return {
                id: `line_${index + 1}`,
                speaker: ensureString(line.speaker || "narrator").trim() || "narrator",
                text,
                durationSec: clamp(ensureNumber(line.durationSec, 1.2), 0.4, 8),
                emotion: ensureString(line.emotion || "neutral").trim() || "neutral"
            };
        })
        .filter(Boolean);
}

function normalizeVideoRequest(prompt, mode, options = {}) {
    const normalizedPrompt = ensureString(prompt).trim();
    if (!normalizedPrompt) {
        throw new Error("Video generation requires a non-empty prompt string");
    }

    const selectedMode = Object.prototype.hasOwnProperty.call(config.profiles, mode)
        ? mode
        : config.defaults.mode;

    const format = ensureString(options.format || config.defaults.format).toLowerCase() === "gif" ? "gif" : "mp4";
    const maxSizeMB = clamp(ensureNumber(options.maxSizeMB, config.defaults.maxSizeMB), 0.25, 10);
    const referenceImages = Array.isArray(options.referenceImages)
        ? options.referenceImages.map((item) => ensureString(item).trim()).filter(Boolean)
        : [];
    const styleHints = Array.isArray(options.styleHints)
        ? options.styleHints.map((item) => ensureString(item).trim()).filter(Boolean)
        : [];

    return {
        prompt: normalizedPrompt,
        mode: selectedMode,
        format,
        maxSizeMB,
        enableEncoding: options.enableEncoding === true,
        strictSize: options.strictSize !== false,
        dialogue: normalizeDialogue(options.dialogue),
        referenceImages,
        styleHints,
        imageOptions: typeof options.imageOptions === "object" && options.imageOptions ? options.imageOptions : {}
    };
}

module.exports = {
    normalizeVideoRequest
};
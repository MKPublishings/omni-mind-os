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

function inferTargetFrames(options = {}, fps = 12, durationSec = 2.5) {
    const requested = ensureNumber(options.targetFrames, fps * durationSec);
    return clamp(Math.round(requested), 12, 48);
}

function hasMotionLanguage(prompt) {
    const lower = String(prompt || "").toLowerCase();
    return /\b(video|gif|animation|animated|motion|moving|pan|tilt|zoom|tracking|camera movement|transition|loop|sequence|frames)\b/.test(lower);
}

function injectMotionClause(prompt) {
    const base = ensureString(prompt).trim();
    const subtleMotion = "subtle motion: gentle camera breathing, light flicker, slight background parallax";
    if (!base) return subtleMotion;
    return `${base}. ${subtleMotion}`;
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
    const promptHasMotion = hasMotionLanguage(normalizedPrompt);
    const motionInjected = !promptHasMotion;
    const motionReadyPrompt = motionInjected ? injectMotionClause(normalizedPrompt) : normalizedPrompt;
    const targetFrames = inferTargetFrames(options, config.profiles[selectedMode]?.fps || 12, config.profiles[selectedMode]?.durationSec || 2.5);
    const referenceImages = Array.isArray(options.referenceImages)
        ? options.referenceImages.map((item) => ensureString(item).trim()).filter(Boolean)
        : [];
    const styleHints = Array.isArray(options.styleHints)
        ? options.styleHints.map((item) => ensureString(item).trim()).filter(Boolean)
        : [];

    return {
        prompt: motionReadyPrompt,
        mode: selectedMode,
        format,
        maxSizeMB,
        generation_mode: "video",
        enableEncoding: options.enableEncoding !== false,
        allowManifestFallback: options.allowManifestFallback === true,
        strictSize: options.strictSize !== false,
        requireMotion: options.requireMotion !== false,
        motionInjected,
        minFrames: 12,
        maxFrames: 48,
        targetFrames,
        dialogue: normalizeDialogue(options.dialogue),
        referenceImages,
        styleHints,
        imageOptions: {
            ...(typeof options.imageOptions === "object" && options.imageOptions ? options.imageOptions : {}),
            generation_mode: "video-keyframe"
        }
    };
}

module.exports = {
    normalizeVideoRequest
};
const fs = require("fs");
const path = require("path");

function ensureString(value, fallback = "") {
    if (typeof value === "string") return value;
    return fallback;
}

module.exports.ensureString = ensureString;

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function exists(relativePath) {
    return fs.existsSync(path.join(__dirname, "..", relativePath));
}

function validateImageEngine() {
    const required = [
        ["index.js", "image entrypoint"],
        ["core/omniImageGenerator.js", "image generator"],
        ["core/modelRouter.js", "model router"],
        ["core/promptOrchestrator.js", "prompt orchestrator"],
        ["io/fileExporter.js", "file exporter"],
        ["utils/smokeTest.js", "image smoke test"]
    ];

    required.forEach(([relativePath, label]) => {
        assert(exists(relativePath), `missing ${label}: ${relativePath}`);
    });

    const imageEntry = require("..");
    assert(imageEntry && typeof imageEntry.omniImageGenerate === "function", "omni-image-engine/index.js must export omniImageGenerate");
    return { valid: true };
}

function validateOmniEngine() {
    return validateImageEngine();
}

if (require.main === module) {
    try {
        validateOmniEngine();
        console.log("[OMNI-IMAGE-ENGINE] Validator passed.");
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("[OMNI-IMAGE-ENGINE][ERROR]", message);
        process.exitCode = 1;
    }
}

module.exports = {
    ensureString,
    validateOmniEngine
};

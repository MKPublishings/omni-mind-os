const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

function fileExists(relativePath) {
    const absolutePath = path.join(__dirname, "..", relativePath);
    return fs.existsSync(absolutePath);
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function validateConfigShape(config) {
    assert(config && typeof config === "object", "videoConfig.json must export an object");
    assert(config.profiles && typeof config.profiles === "object", "videoConfig.json must include profiles");

    ["crisp-short", "balanced", "long-soft"].forEach((profileName) => {
        const profile = config.profiles[profileName];
        assert(profile && typeof profile === "object", `missing profile: ${profileName}`);
        ["width", "height", "fps", "durationSec"].forEach((key) => {
            assert(typeof profile[key] === "number" && Number.isFinite(profile[key]), `${profileName}.${key} must be a finite number`);
        });
    });

    assert(config.defaults && typeof config.defaults === "object", "videoConfig.json must include defaults");
}

function checkFfmpeg() {
    const result = spawnSync("ffmpeg", ["-version"], { stdio: "ignore" });
    return result && result.status === 0;
}

function validateVideoEngine() {
    const requiredFiles = [
        ["contracts.js", "contracts"],
        ["index.js", "video entrypoint"],
        ["core/videoEngine.js", "video engine"],
        ["core/sceneAndShotParser.js", "scene parser"],
        ["core/physicsConditioner.js", "physics conditioner"],
        ["core/dialogueAligner.js", "dialogue aligner"],
        ["core/contextTracker.js", "context tracker"],
        ["core/storyboardBuilder.js", "storyboard builder"],
        ["core/optimizationPlanner.js", "optimization planner"],
        ["io/manifestExporter.js", "manifest exporter"],
        ["io/ffmpegEncoder.js", "ffmpeg encoder"],
        ["utils/videoContractValidator.js", "contract validator"],
        ["utils/videoSmokeTest.js", "video smoke test"],
        ["config/videoConfig.json", "video config"]
    ];

    requiredFiles.forEach(([relativePath, label]) => {
        assert(fileExists(relativePath), `missing ${label}: video/${relativePath}`);
    });

    const config = require("../config/videoConfig.json");
    validateConfigShape(config);

    const entrySource = fs.readFileSync(path.join(__dirname, "..", "index.js"), "utf8");
    assert(/generateVideoClip/.test(entrySource), "video/index.js must reference generateVideoClip export");

    const contractValidator = require("./videoContractValidator");
    assert(contractValidator && typeof contractValidator.validateVideoResult === "function", "videoContractValidator must export validateVideoResult");

    const ffmpegAvailable = checkFfmpeg();

    return {
        valid: true,
        ffmpegAvailable
    };
}

if (require.main === module) {
    try {
        const report = validateVideoEngine();
        console.log("[OMNI-VIDEO-ENGINE] Phase 6 validator passed.");
        if (!report.ffmpegAvailable) {
            console.log("[OMNI-VIDEO-ENGINE] ffmpeg not found (encoding remains optional with manifest fallback).");
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("[OMNI-VIDEO-ENGINE][ERROR]", message);
        process.exitCode = 1;
    }
}

module.exports = {
    validateVideoEngine
};
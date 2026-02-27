const config = require("../config/videoConfig.json");

function estimateSizeMB({ width, height, fps, durationSec, motionComplexity = 1 }) {
    const pixels = width * height;
    const kbps = (pixels / 307200) * fps * 35 * motionComplexity;
    const sizeMB = (kbps * durationSec) / 8192;
    return Number(sizeMB.toFixed(3));
}

function inferMotionComplexity(request) {
    const text = request.prompt.toLowerCase();
    const highMotionTerms = ["run", "explode", "fight", "storm", "chase", "rapid", "chaotic", "shaking", "camera move"];
    const hits = highMotionTerms.reduce((count, term) => (text.includes(term) ? count + 1 : count), 0);
    return 1 + Math.min(0.6, hits * 0.1);
}

function createBudget(request) {
    const base = config.profiles[request.mode] || config.profiles[config.defaults.mode];
    const motionComplexity = inferMotionComplexity(request);

    let width = base.width;
    let height = base.height;
    let fps = base.fps;
    let durationSec = base.durationSec;
    let estimatedSizeMB = estimateSizeMB({ width, height, fps, durationSec, motionComplexity });

    if (estimatedSizeMB > request.maxSizeMB) {
        fps = Math.max(8, Math.floor(fps * 0.85));
        estimatedSizeMB = estimateSizeMB({ width, height, fps, durationSec, motionComplexity });
    }

    if (estimatedSizeMB > request.maxSizeMB) {
        width = Math.max(384, Math.floor(width * 0.85));
        height = Math.max(384, Math.floor(height * 0.85));
        estimatedSizeMB = estimateSizeMB({ width, height, fps, durationSec, motionComplexity });
    }

    if (estimatedSizeMB > request.maxSizeMB) {
        durationSec = Math.max(1, Number((durationSec * 0.8).toFixed(2)));
        estimatedSizeMB = estimateSizeMB({ width, height, fps, durationSec, motionComplexity });
    }

    return {
        maxSizeMB: request.maxSizeMB,
        width,
        height,
        fps,
        durationSec,
        estimatedSizeMB,
        motionComplexity
    };
}

module.exports = {
    createBudget
};
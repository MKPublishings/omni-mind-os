function buildOptimizationPlan(request, budget) {
    const tiers = [];

    tiers.push({
        name: "current",
        width: budget.width,
        height: budget.height,
        fps: budget.fps,
        durationSec: budget.durationSec
    });

    tiers.push({
        name: "fps-reduced",
        width: budget.width,
        height: budget.height,
        fps: Math.max(8, budget.fps - 2),
        durationSec: budget.durationSec
    });

    tiers.push({
        name: "resolution-reduced",
        width: Math.max(384, Math.floor(budget.width * 0.85)),
        height: Math.max(384, Math.floor(budget.height * 0.85)),
        fps: Math.max(8, budget.fps - 2),
        durationSec: budget.durationSec
    });

    tiers.push({
        name: "duration-reduced",
        width: Math.max(384, Math.floor(budget.width * 0.85)),
        height: Math.max(384, Math.floor(budget.height * 0.85)),
        fps: Math.max(8, budget.fps - 2),
        durationSec: Math.max(1, Number((budget.durationSec * 0.75).toFixed(2)))
    });

    return {
        targetMaxSizeMB: request.maxSizeMB,
        strictSize: request.strictSize,
        runtimeCache: {
            enabled: true,
            scope: "process"
        },
        modelHints: {
            distillationTarget: "short-form-student",
            quantizationTarget: "int8-ready"
        },
        adaptiveTiers: tiers
    };
}

module.exports = {
    buildOptimizationPlan
};
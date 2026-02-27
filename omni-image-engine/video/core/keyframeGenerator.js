const runtimeKeyframeCache = new Map();

function makeCacheKey(prompt, width, height, imageOptions = {}) {
    const stableOptions = {
        format: imageOptions.format || "png",
        model: imageOptions.model || "default",
        style: imageOptions.style || "default"
    };
    return JSON.stringify({ prompt, width, height, stableOptions });
}

async function generateKeyframes(request, budget, keyframePlan, imageGenerateFn) {
    if (typeof imageGenerateFn !== "function") {
        throw new Error("Video engine requires an image generation function for keyframes");
    }

    const generated = [];
    for (const keyframe of keyframePlan) {
        const generationOptions = {
            ...request.imageOptions,
            width: budget.width,
            height: budget.height,
            ratio: `${budget.width}:${budget.height}`
        };
        const cacheKey = makeCacheKey(keyframe.prompt, budget.width, budget.height, generationOptions);

        let filePath = runtimeKeyframeCache.get(cacheKey);
        const cacheHit = Boolean(filePath);
        if (!filePath) {
            const result = await imageGenerateFn(keyframe.prompt, generationOptions);
            filePath = result.filePath;
            runtimeKeyframeCache.set(cacheKey, filePath);
        }

        generated.push({
            ...keyframe,
            filePath,
            cached: cacheHit
        });
    }

    return generated;
}

module.exports = {
    generateKeyframes
};
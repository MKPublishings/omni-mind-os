function isObject(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function validateBudget(budget) {
    assert(isObject(budget), "budget must be an object");
    ["maxSizeMB", "width", "height", "fps", "durationSec", "estimatedSizeMB"].forEach((key) => {
        assert(typeof budget[key] === "number" && Number.isFinite(budget[key]), `budget.${key} must be a finite number`);
    });
}

function validateArrays(result) {
    ["shots", "keyframes", "physicsChannels", "storyboard", "entityTracks", "dialogueTimeline"].forEach((key) => {
        assert(Array.isArray(result[key]), `${key} must be an array`);
    });
}

function validateOutput(output) {
    assert(isObject(output), "output must be an object");
    assert(typeof output.type === "string", "output.type must be a string");
    assert(typeof output.filePath === "string" && output.filePath.length > 0, "output.filePath must be a non-empty string");
    const allowed = new Set(["manifest", "mp4", "gif"]);
    assert(allowed.has(output.type), "output.type must be one of manifest/mp4/gif");
}

function validateEncoder(encoder) {
    assert(isObject(encoder), "encoder must be an object");
    assert(typeof encoder.used === "boolean", "encoder.used must be boolean");
    assert(typeof encoder.reason === "string" && encoder.reason.length > 0, "encoder.reason must be a non-empty string");
    if (encoder.used) {
        assert(typeof encoder.sizeMB === "number" && Number.isFinite(encoder.sizeMB), "encoder.sizeMB must be finite when encoder.used=true");
        assert(typeof encoder.budgetMB === "number" && Number.isFinite(encoder.budgetMB), "encoder.budgetMB must be finite when encoder.used=true");
    }
}

function validateVideoResult(result) {
    assert(isObject(result), "result must be an object");
    assert(["crisp-short", "balanced", "long-soft"].includes(result.mode), "mode must be a known profile");
    assert(["mp4", "gif"].includes(result.format), "format must be mp4 or gif");
    validateBudget(result.budget);
    validateArrays(result);
    validateOutput(result.output);
    validateEncoder(result.encoder);

    assert(isObject(result.context), "context must be an object");
    assert(isObject(result.sceneGraph), "sceneGraph must be an object");
    assert(isObject(result.optimization), "optimization must be an object");
    assert(Array.isArray(result.optimization.adaptiveTiers), "optimization.adaptiveTiers must be an array");

    result.keyframes.forEach((frame, index) => {
        assert(typeof frame.shotId === "string", `keyframes[${index}].shotId must be a string`);
        assert(typeof frame.filePath === "string" && frame.filePath.length > 0, `keyframes[${index}].filePath must be a non-empty string`);
    });

    return true;
}

module.exports = {
    validateVideoResult
};
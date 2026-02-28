const { routePromptIntent } = require("./intentRouter");

function ensureType(value, fallback = "auto") {
    const normalized = String(value || fallback).toLowerCase();
    if (["image", "video", "auto"].includes(normalized)) {
        return normalized;
    }
    return fallback;
}

function applyGenerationToken(prompt, intent) {
    const raw = String(prompt || "").trim();
    if (!raw) return raw;

    if (/^<still>\s+/i.test(raw) || /^<motion>\s+/i.test(raw)) {
        return raw;
    }

    if (intent === "image") {
        return `<still> ${raw}`;
    }

    if (intent === "video") {
        return `<motion> ${raw}`;
    }

    return raw;
}

function normalizeStillPromptLanguage(prompt) {
    return String(prompt || "")
        .replace(/\bcinematic\b/gi, "cinematic lighting")
        .replace(/\bdynamic\b/gi, "dynamic composition")
        .replace(/\bscene\b/gi, "still scene");
}

function buildMismatchError(requestedType, routing) {
    const target = requestedType === "image" ? "video" : "image";
    const ask = "Do you want a still image or a video?";
    const terms = routing.matched[target] || [];
    const termsText = terms.length ? ` Trigger terms: ${terms.join(", ")}.` : "";

    const error = new Error(
        `Prompt intent routes to ${target} (confidence ${routing.confidence}) but requested ${requestedType}.${termsText} ${ask}`.trim()
    );
    error.code = "AMBIGUOUS_GENERATION_INTENT";
    error.routing = routing;
    return error;
}

function validatePromptForGeneration(prompt, options = {}) {
    const requestedType = ensureType(options.requestedType, "auto");
    const strict = options.strictRouting !== false;
    const routing = routePromptIntent(prompt, {
        preferredIntent: requestedType,
        userHistory: options.userHistory,
        confidenceThreshold: options.confidenceThreshold
    });

    let resolvedType = requestedType === "auto" ? routing.intent : requestedType;
    if (resolvedType === "ambiguous") {
        resolvedType = options.defaultType === "video" ? "video" : "image";
    }

    if (
        strict &&
        requestedType !== "auto" &&
        routing.intent !== "ambiguous" &&
        requestedType !== routing.intent &&
        routing.confidence >= routing.threshold
    ) {
        throw buildMismatchError(requestedType, routing);
    }

    let normalizedPrompt = applyGenerationToken(prompt, resolvedType);
    if (resolvedType === "image") {
        normalizedPrompt = normalizeStillPromptLanguage(normalizedPrompt);
    }

    return {
        requestedType,
        resolvedType,
        normalizedPrompt,
        routing
    };
}

module.exports = {
    applyGenerationToken,
    validatePromptForGeneration,
    normalizeStillPromptLanguage
};

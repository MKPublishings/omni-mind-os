function ensureType(value, fallback = "image") {
    const normalized = String(value || fallback).toLowerCase();
    if (["image", "auto"].includes(normalized)) {
        return normalized;
    }
    return "image";
}

function applyGenerationToken(prompt, intent) {
    const raw = String(prompt || "").trim();
    if (!raw) return raw;

    if (/^<still>\s+/i.test(raw)) {
        return raw;
    }

    return `<still> ${raw}`;
}

function normalizeStillPromptLanguage(prompt) {
    return String(prompt || "")
        .replace(/\bcinematic\b/gi, "cinematic lighting")
        .replace(/\bdynamic\b/gi, "dynamic composition")
        .replace(/\bscene\b/gi, "still scene");
}

function validatePromptForGeneration(prompt, options = {}) {
    const requestedType = ensureType(options.requestedType, "image");
    const resolvedType = "image";
    let normalizedPrompt = applyGenerationToken(prompt, resolvedType);
    normalizedPrompt = normalizeStillPromptLanguage(normalizedPrompt);

    return {
        requestedType,
        resolvedType,
        normalizedPrompt,
        routing: {
            intent: "image",
            confidence: 1,
            threshold: 1,
            shouldAskUser: false,
            matched: {
                image: []
            }
        }
    };
}

module.exports = {
    applyGenerationToken,
    validatePromptForGeneration,
    normalizeStillPromptLanguage
};

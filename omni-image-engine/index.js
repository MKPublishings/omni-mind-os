const omniImageGenerator = require("./core/omniImageGenerator");
const { Laws } = require("./core/lawRegistry");
const logger = require("./utils/logger");
const { ensureString } = require("./utils/validator");
const { validatePromptForGeneration } = require("./routing/promptValidator");
const { evaluateContentPolicy } = require("./routing/contentPolicy");

function throwPolicyError(report) {
    const error = new Error(report.advice);
    error.code = "CONTENT_POLICY_BLOCKED";
    error.policy = report;
    throw error;
}

function enforceSafety(prompt, options = {}) {
    const report = evaluateContentPolicy(prompt, options);
    if (!report.allowed) {
        throwPolicyError(report);
    }
    return report;
}

async function omniImageGenerate(userPrompt, options = {}) {
    const normalizedPrompt = ensureString(userPrompt).trim();
    if (!normalizedPrompt) {
        throw new Error("Image generation requires a non-empty prompt string");
    }

    const policy = enforceSafety(normalizedPrompt, options);

    const validation = validatePromptForGeneration(normalizedPrompt, {
        ...options,
        requestedType: "image",
        defaultType: "image",
        strictRouting: options.strictRouting !== false
    });

    logger.info("User prompt:", validation.normalizedPrompt);

    const result = await omniImageGenerator.generate(validation.normalizedPrompt, {
        ...options,
        generation_mode: "image"
    });

    logger.info("Generation complete. File:", result.filePath);
    return {
        ...result,
        policy,
        routing: validation.routing
    };
}

async function omniGenerate(userPrompt, options = {}) {
    const normalizedPrompt = ensureString(userPrompt).trim();
    if (!normalizedPrompt) {
        throw new Error("Generation requires a non-empty prompt string");
    }

    const policy = enforceSafety(normalizedPrompt, options);

    const validation = validatePromptForGeneration(normalizedPrompt, {
        ...options,
        requestedType: "image",
        defaultType: "image",
        strictRouting: true
    });

    const result = await omniImageGenerate(validation.normalizedPrompt, options);
    return {
        ...result,
        policy
    };
}

module.exports = {
    omniGenerate,
    omniImageGenerate,
    Laws
};

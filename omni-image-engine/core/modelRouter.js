const modelConfig = require("../config/modelConfig.json");
const logger = require("../utils/logger");

function assertString(value, name) {
    if (!value || typeof value !== "string") {
        throw new Error(`Missing required ${name}`);
    }
}

function toOpenAIImageSize(width, height) {
    const w = Number(width) || 1024;
    const h = Number(height) || 1024;
    return `${Math.max(256, Math.floor(w))}x${Math.max(256, Math.floor(h))}`;
}

function gcd(a, b) {
    let x = Math.abs(a);
    let y = Math.abs(b);
    while (y !== 0) {
        const t = y;
        y = x % y;
        x = t;
    }
    return x || 1;
}

function toAspectRatio(width, height) {
    const w = Math.max(1, Math.floor(Number(width) || 1024));
    const h = Math.max(1, Math.floor(Number(height) || 1024));
    const divisor = gcd(w, h);
    return `${Math.floor(w / divisor)}:${Math.floor(h / divisor)}`;
}

function getApiKey(options, fallbackEnvName) {
    if (options.apiKey) return options.apiKey;
    if (options.apiKeyEnv && process.env[options.apiKeyEnv]) {
        return process.env[options.apiKeyEnv];
    }
    if (fallbackEnvName && process.env[fallbackEnvName]) {
        return process.env[fallbackEnvName];
    }
    return "";
}

async function callOpenAIImages(prompt, options) {
    const endpoint = options.endpoint || "https://api.openai.com/v1/images/generations";
    const apiKey = getApiKey(options, "OPENAI_API_KEY");
    assertString(apiKey, "OPENAI_API_KEY");

    const model = options.providerModel || "gpt-image-1";
    const body = {
        model,
        prompt,
        size: toOpenAIImageSize(options.width, options.height),
        quality: options.quality || "high",
        n: 1,
        response_format: "b64_json"
    };

    const res = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    });

    if (!res.ok) {
        const reason = await res.text();
        throw new Error(`OpenAI image generation failed (${res.status}): ${reason}`);
    }

    const json = await res.json();
    const b64 = json?.data?.[0]?.b64_json;
    if (!b64) {
        throw new Error("OpenAI response did not include image data");
    }

    return Buffer.from(b64, "base64");
}

async function callStabilityImages(prompt, options) {
    const endpoint = options.endpoint || "https://api.stability.ai/v2beta/stable-image/generate/core";
    const apiKey = getApiKey(options, "STABILITY_API_KEY");
    assertString(apiKey, "STABILITY_API_KEY");

    const formData = new FormData();
    formData.append("prompt", String(prompt || ""));
    formData.append("output_format", String(options.format || "png").toLowerCase());

    const aspectRatio = toAspectRatio(options.width, options.height);
    formData.append("aspect_ratio", aspectRatio);

    if (options.negativePrompt) {
        formData.append("negative_prompt", String(options.negativePrompt));
    }

    const res = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Accept": "image/*"
        },
        body: formData
    });

    if (!res.ok) {
        const reason = await res.text();
        throw new Error(`Stability image generation failed (${res.status}): ${reason}`);
    }

    const contentType = String(res.headers.get("content-type") || "").toLowerCase();
    if (contentType.includes("application/json")) {
        const json = await res.json();
        const b64 = json?.image || json?.artifacts?.[0]?.base64;
        if (!b64) {
            throw new Error("Stability response did not include image data");
        }
        return Buffer.from(b64, "base64");
    }

    const bytes = await res.arrayBuffer();
    return Buffer.from(bytes);
}

async function callUnderlyingModel(prompt, options) {
    const provider = String(options.provider || "openai").toLowerCase();
    logger.info(`Calling provider: ${provider}`);

    if (provider === "openai") {
        return callOpenAIImages(prompt, options);
    }

    if (provider === "stability") {
        return callStabilityImages(prompt, options);
    }

    throw new Error(`Unsupported image provider: ${provider}`);
}

function resolveModelAttemptChain(primaryModelName, overrideFallbackModels = []) {
    const chain = [];
    const visited = new Set();
    let cursor = primaryModelName;

    while (cursor && !visited.has(cursor)) {
        visited.add(cursor);
        chain.push(cursor);
        const next = modelConfig.models?.[cursor]?.fallbackModel;
        cursor = next || "";
    }

    for (const candidate of overrideFallbackModels || []) {
        if (!candidate || visited.has(candidate)) continue;
        visited.add(candidate);
        chain.push(candidate);
    }

    return chain;
}

function buildMergedOptions(modelSettings, options) {
    return {
        provider: modelSettings.provider || "openai",
        providerModel: modelSettings.providerModel,
        endpoint: modelSettings.endpoint,
        apiKeyEnv: modelSettings.apiKeyEnv,
        apiKey: modelSettings.apiKeyEnv ? process.env[modelSettings.apiKeyEnv] : undefined,
        width: options.width || modelSettings.defaultWidth,
        height: options.height || modelSettings.defaultHeight,
        steps: options.steps || modelSettings.defaultSteps,
        cfgScale: options.cfgScale || modelSettings.defaultCfgScale,
        ...options
    };
}

async function generateImage(finalPrompt, options = {}) {
    const primaryModelName = options.model || modelConfig.defaultModel;
    const fallbackModels = Array.isArray(options.fallbackModels) ? options.fallbackModels : [];
    const attemptChain = resolveModelAttemptChain(primaryModelName, fallbackModels);

    if (!attemptChain.length) {
        throw new Error("No model is configured for generation");
    }

    const errors = [];

    for (const modelName of attemptChain) {
        const modelSettings = modelConfig.models[modelName];
        if (!modelSettings) {
            errors.push(`Unknown model '${modelName}' in modelConfig.json`);
            continue;
        }

        const mergedOptions = buildMergedOptions(modelSettings, options);

        try {
            const buffer = await callUnderlyingModel(finalPrompt, mergedOptions);
            if (modelName !== primaryModelName) {
                logger.info(`Fallback provider succeeded via model '${modelName}'`);
            }
            return buffer;
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            errors.push(`[${modelName}] ${message}`);
            logger.error(`Provider attempt failed for '${modelName}':`, message);
        }
    }

    throw new Error(`All image providers failed. Attempts: ${errors.join(" | ")}`);
}

module.exports = {
    generateImage
};

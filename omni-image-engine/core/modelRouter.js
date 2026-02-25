const modelConfig = require("../config/modelConfig.json");
const logger = require("../utils/logger");

const RATIO_PRESETS = {
    "1:1": [1, 1],
    "4:3": [4, 3],
    "3:4": [3, 4],
    "3:2": [3, 2],
    "2:3": [2, 3],
    "16:9": [16, 9],
    "9:16": [9, 16],
    "21:9": [21, 9],
    "9:21": [9, 21],
    "5:4": [5, 4],
    "4:5": [4, 5],
    "18:9": [18, 9],
    "9:18": [9, 18],
    "2:1": [2, 1],
    "1:2": [1, 2]
};

const RESOLUTION_PRESETS = {
    "512": 512,
    "720p": 1280,
    "1080p": 1920,
    "1440p": 2560,
    "4k": 3840,
    "5k": 5120,
    "6k": 6144,
    "8k": 7680
};

const OPENAI_ALLOWED_SIZES = [
    [1024, 1024],
    [1536, 1024],
    [1024, 1536]
];

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

function toPositiveInt(value, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return fallback;
    return Math.floor(n);
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
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

function parseRatio(ratioInput) {
    const raw = String(ratioInput || "").trim();
    if (!raw) return null;

    if (RATIO_PRESETS[raw]) {
        return RATIO_PRESETS[raw];
    }

    const match = raw.match(/^(\d+)\s*:\s*(\d+)$/);
    if (!match) return null;

    const rw = Number(match[1]);
    const rh = Number(match[2]);
    if (!Number.isFinite(rw) || !Number.isFinite(rh) || rw <= 0 || rh <= 0) {
        return null;
    }
    return [rw, rh];
}

function deriveDimensions(options = {}) {
    const maxSide = toPositiveInt(options.maxSide || modelConfig.maxOutputSide || 8192, 8192);
    const minSide = toPositiveInt(options.minSide || modelConfig.minOutputSide || 256, 256);

    let width = toPositiveInt(options.width, 0);
    let height = toPositiveInt(options.height, 0);

    const ratioPair = parseRatio(options.ratio || options.aspectRatio || "");
    const presetSide = RESOLUTION_PRESETS[String(options.resolution || "").toLowerCase()];

    if (width > 0 && height > 0) {
        return {
            width: clamp(width, minSide, maxSide),
            height: clamp(height, minSide, maxSide)
        };
    }

    if (ratioPair && presetSide) {
        const [rw, rh] = ratioPair;
        if (rw >= rh) {
            width = presetSide;
            height = Math.max(minSide, Math.floor((presetSide * rh) / rw));
        } else {
            height = presetSide;
            width = Math.max(minSide, Math.floor((presetSide * rw) / rh));
        }

        return {
            width: clamp(width, minSide, maxSide),
            height: clamp(height, minSide, maxSide)
        };
    }

    if (ratioPair) {
        const [rw, rh] = ratioPair;
        const base = toPositiveInt(options.longEdge || options.shortEdge || 2048, 2048);
        if (rw >= rh) {
            width = base;
            height = Math.max(minSide, Math.floor((base * rh) / rw));
        } else {
            height = base;
            width = Math.max(minSide, Math.floor((base * rw) / rh));
        }

        return {
            width: clamp(width, minSide, maxSide),
            height: clamp(height, minSide, maxSide)
        };
    }

    if (presetSide) {
        return {
            width: clamp(presetSide, minSide, maxSide),
            height: clamp(presetSide, minSide, maxSide)
        };
    }

    return {
        width: clamp(toPositiveInt(options.defaultWidth, 1024), minSide, maxSide),
        height: clamp(toPositiveInt(options.defaultHeight, 1024), minSide, maxSide)
    };
}

function chooseOpenAISize(width, height) {
    const w = toPositiveInt(width, 1024);
    const h = toPositiveInt(height, 1024);

    let best = OPENAI_ALLOWED_SIZES[0];
    let bestScore = Number.POSITIVE_INFINITY;

    for (const candidate of OPENAI_ALLOWED_SIZES) {
        const [cw, ch] = candidate;
        const score = Math.abs(cw - w) + Math.abs(ch - h);
        if (score < bestScore) {
            bestScore = score;
            best = candidate;
        }
    }

    return { width: best[0], height: best[1] };
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

    const requestSize = chooseOpenAISize(options.width, options.height);
    if (requestSize.width !== options.width || requestSize.height !== options.height) {
        logger.info(`OpenAI size adjusted to supported size ${requestSize.width}x${requestSize.height}`);
    }

    const model = options.providerModel || "gpt-image-1";
    const body = {
        model,
        prompt,
        size: toOpenAIImageSize(requestSize.width, requestSize.height),
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
    const resolved = deriveDimensions({
        ...options,
        defaultWidth: options.width || modelSettings.defaultWidth,
        defaultHeight: options.height || modelSettings.defaultHeight
    });

    return {
        provider: modelSettings.provider || "openai",
        providerModel: modelSettings.providerModel,
        endpoint: modelSettings.endpoint,
        apiKeyEnv: modelSettings.apiKeyEnv,
        apiKey: modelSettings.apiKeyEnv ? process.env[modelSettings.apiKeyEnv] : undefined,
        ratio: options.ratio || options.aspectRatio || "",
        resolution: options.resolution || "",
        width: resolved.width,
        height: resolved.height,
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

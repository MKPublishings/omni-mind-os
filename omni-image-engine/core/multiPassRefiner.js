const negativePrompting = require("./negativePrompting");
const sceneEnforcer = require("./sceneEnforcer");
const applyFreshness = require("./promptFreshness");
const logger = require("../utils/logger");
const qualityConfig = require("../config/qualityTags.json");

function inferTimeIntent(prompt) {
    const lower = String(prompt || "").toLowerCase();

    if (/(bedroom|room|office|studio|kitchen|indoor|interior)/.test(lower)) return "indoor";
    if (/(night|midnight|starlight|starry|nighttime)/.test(lower)) return "night";
    if (/(sunset|golden hour|dusk|twilight)/.test(lower)) return "sunset";
    if (/(day|daytime|sunlight|morning|noon|afternoon)/.test(lower)) return "day";

    return "neutral";
}

function promptRequestsPeople(prompt) {
    const lower = String(prompt || "").toLowerCase();
    return /\b(person|people|character|characters|man|woman|boy|girl|child|children|human|humans|crowd|portrait|selfie|face|worker|hiker|runner|couple|family)\b/.test(lower);
}

function applyStrictFidelityNegatives(data) {
    const prompt = String(data.userPrompt || "").toLowerCase();
    const negativeTags = [...(data.negativeTags || [])];
    const timeIntent = inferTimeIntent(prompt);
    const explicitlyRequestsNight = timeIntent === "night";

    if (!explicitlyRequestsNight && !prompt.includes("night")) {
        negativeTags.push("no starry sky", "no nighttime atmosphere unless requested");
    }

    if (!promptRequestsPeople(prompt)) {
        negativeTags.push("no people", "no characters", "no human subjects", "no portraits", "no crowd");
    }

    data.negativeTags = [...new Set(negativeTags)];
    return data;
}

function semanticExpansionPass(data) {
    // Already expanded in orchestrator; extend here if needed
    return data;
}

function technicalEnhancementPass(data, qualityLevel) {
    const level = qualityLevel || "default";
    const tags = qualityConfig[level] || qualityConfig["default"] || [];
    data.technicalTags = [...data.technicalTags, ...tags];
    return data;
}

module.exports = function multiPassRefiner(promptData, options = {}) {
    let data = { ...promptData };

    // Pass 1: semantic expansion
    data = semanticExpansionPass(data);

    // Pass 2: technical enhancement
    data = technicalEnhancementPass(data, options.quality);

    // Pass 3: negative prompting
    data = negativePrompting(data);

    // Pass 3b: strict fidelity negatives parity with /api/image
    data = applyStrictFidelityNegatives(data);

    // Pass 4: scene enforcement
    data = sceneEnforcer(data);

    // Build final prompt string
    let finalPrompt = [
        data.semanticExpansion,
        data.styleTags.join(", "),
        data.technicalTags.join(", ")
    ].filter(Boolean).join(", ");

    if (data.negativeTags.length) {
        finalPrompt = `${finalPrompt}, negative: ${data.negativeTags.join(", ")}`;
    }

    data.finalPrompt = finalPrompt;

    // Freshness options (seed, etc.)
    const finalOptions = applyFreshness(options);

    logger.info("Final refined prompt:", data.finalPrompt);
    return { data, finalOptions };
};

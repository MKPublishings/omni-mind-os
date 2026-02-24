const stylePacks = require("./stylePacks");
const visualIntelligence = require("./visualIntelligence");
const tokenizer = require("../utils/tokenizer");
const logger = require("../utils/logger");

function inferSceneDescription(prompt) {
    const lower = String(prompt || "").toLowerCase();

    if (lower.includes("park")) {
        return "park environment matching the prompt, natural landscape continuity";
    }
    if (lower.includes("bedroom") || lower.includes("room")) {
        return "cozy interior, detailed furniture, realistic lighting";
    }
    if (lower.includes("forest")) {
        return "dense trees, atmospheric fog, grounded natural lighting";
    }
    if (lower.includes("city")) {
        return "urban environment, buildings, grounded textures, depth and perspective";
    }

    return "coherent environment matching the subject and mood";
}

function inferTimeIntent(prompt) {
    const lower = String(prompt || "").toLowerCase();

    if (/(bedroom|room|office|studio|kitchen|indoor|interior)/.test(lower)) return "indoor";
    if (/(night|midnight|moon|moonlight|starlight|starry|nighttime)/.test(lower)) return "night";
    if (/(sunset|golden hour|dusk|twilight)/.test(lower)) return "sunset";
    if (/(day|daytime|sunlight|morning|noon|afternoon)/.test(lower)) return "day";

    return "neutral";
}

function buildTimeDirective(intent) {
    if (intent === "night") return "nighttime scene when appropriate, coherent low-light rendering";
    if (intent === "sunset") return "sunset lighting, warm sky tones, no moon unless requested";
    if (intent === "day") return "daytime lighting, natural sunlight, clear atmosphere, no moon";
    if (intent === "indoor") return "interior lighting setup, practical lights, no night sky elements unless requested";
    return "neutral natural lighting, balanced exposure, avoid moon and night sky unless explicitly requested";
}

function buildStrictPromptDirective() {
    return "strict prompt fidelity: include only elements explicitly requested by the user; do not add extra subjects, characters, objects, text, logos, or overlays";
}

module.exports = function promptOrchestrator(userPrompt, options = {}) {
    const tokens = tokenizer(userPrompt);

    const base = {
        userPrompt,
        tokens,
        semanticExpansion: "",
        technicalTags: [],
        styleTags: [],
        negativeTags: [],
        finalPrompt: ""
    };

    const sceneInsights = visualIntelligence.inferScene(userPrompt);
    const sceneDescription = inferSceneDescription(userPrompt) || sceneInsights.description;
    const timeDirective = buildTimeDirective(inferTimeIntent(userPrompt));
    const strictDirective = buildStrictPromptDirective();
    const stylePackName = options.stylePack || "";
    const stylePack = stylePacks.getStylePack(stylePackName);

    const semanticExpansion = [
        userPrompt,
        sceneDescription,
        timeDirective,
        strictDirective
    ].join(", ");

    const styleTags = stylePack.tags || [];
    const technicalTags = [];

    const finalPrompt = [
        semanticExpansion,
        styleTags.join(", "),
        technicalTags.join(", ")
    ].filter(Boolean).join(", ");

    const orchestrated = {
        ...base,
        semanticExpansion,
        technicalTags,
        styleTags,
        negativeTags: [],
        finalPrompt
    };

    logger.info("Orchestrated prompt:", orchestrated.finalPrompt);
    return orchestrated;
};

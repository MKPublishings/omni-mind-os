const modelConfig = require("../config/modelConfig.json");

function toSlizzai(promptData) {
    const cfg = modelConfig.models["slizzai_v2_1"];

    const tags = [
        promptData.semanticExpansion,
        promptData.styleTags.join(", "),
        promptData.technicalTags.join(", ")
    ].filter(Boolean).join(", ");

    let finalPrompt = tags;

    if (promptData.negativeTags && promptData.negativeTags.length) {
        finalPrompt += `, negative: ${promptData.negativeTags.join(", ")}`;
    }

    promptData.finalPrompt = finalPrompt;
    promptData.model = cfg.name;

    return promptData;
}

module.exports = {
    toSlizzai
};

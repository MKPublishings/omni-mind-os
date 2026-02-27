const config = require("../config/videoConfig.json");

function splitPromptIntoChunks(prompt) {
    return prompt
        .split(/[.!?]+/)
        .map((part) => part.trim())
        .filter(Boolean);
}

function buildSceneGraph(request) {
    const entities = [];
    const seedWords = request.prompt.toLowerCase().split(/\s+/).slice(0, 6);
    seedWords.forEach((word, index) => {
        if (word.length < 4) return;
        entities.push({
            id: `entity_${index + 1}`,
            label: word
        });
    });

    return {
        summary: request.prompt,
        entities,
        mood: config.defaults.mood,
        lighting: "balanced",
        physics: {
            gravity: [0, -9.8, 0]
        }
    };
}

function buildShots(request, budget) {
    const chunks = splitPromptIntoChunks(request.prompt);
    const shotCount = Math.max(1, Math.min(2, chunks.length));
    const durationPerShot = Number((budget.durationSec / shotCount).toFixed(2));

    const shots = [];
    for (let index = 0; index < shotCount; index += 1) {
        const dialogueLine = request.dialogue[index] || null;
        const description = chunks[index] || request.prompt;
        shots.push({
            id: `shot_${index + 1}`,
            description,
            durationSec: durationPerShot,
            camera: config.defaults.camera,
            dialogueWindow: dialogueLine
                ? {
                    startSec: 0,
                    endSec: Math.min(durationPerShot, dialogueLine.durationSec),
                    emotion: dialogueLine.emotion
                }
                : undefined
        });
    }

    return shots;
}

function parseSceneAndShots(request, budget) {
    const sceneGraph = buildSceneGraph(request);
    const shots = buildShots(request, budget);
    return {
        sceneGraph,
        shots
    };
}

module.exports = {
    parseSceneAndShots
};
function normalizeMood(sceneGraph) {
    const mood = String(sceneGraph.mood || "cinematic").trim().toLowerCase();
    return mood || "cinematic";
}

function buildGlobalContext(request, sceneGraph, budget) {
    return {
        theme: sceneGraph.summary,
        mood: normalizeMood(sceneGraph),
        location: request.referenceImages.length ? "reference-conditioned" : "prompt-defined",
        timeOfDay: /(night|dusk|midnight|moon)/i.test(request.prompt) ? "night" : "day",
        durationSec: budget.durationSec,
        styleHints: request.styleHints
    };
}

function buildEntityTracks(sceneGraph, shots) {
    const entities = Array.isArray(sceneGraph.entities) ? sceneGraph.entities : [];
    return entities.map((entity, entityIndex) => ({
        entityId: entity.id,
        label: entity.label,
        states: shots.map((shot, shotIndex) => ({
            shotId: shot.id,
            position: {
                x: Number((entityIndex * 0.12 + shotIndex * 0.07).toFixed(2)),
                y: Number((0.45 - shotIndex * 0.08).toFixed(2)),
                z: Number((0.2 + entityIndex * 0.03).toFixed(2))
            },
            state: shotIndex === 0 ? "introduce" : "continue"
        }))
    }));
}

module.exports = {
    buildGlobalContext,
    buildEntityTracks
};
function inferBaseVelocity(text) {
    const lower = String(text || "").toLowerCase();
    if (/(run|dash|chase|sprint|fast)/.test(lower)) return [2.4, 0, 0];
    if (/(float|hover|drift)/.test(lower)) return [0.5, 0.2, 0];
    if (/(fall|drop|collapse)/.test(lower)) return [0, -1.2, 0];
    return [0.8, 0, 0];
}

function inferCollisionHint(text) {
    const lower = String(text || "").toLowerCase();
    if (/(wall|ground|floor|table|street|road)/.test(lower)) {
        return "surface-contact";
    }
    if (/(water|ocean|river|rain)/.test(lower)) {
        return "fluid-interaction";
    }
    return "none";
}

function buildPhysicsChannels(sceneGraph, shots) {
    const gravity = Array.isArray(sceneGraph.physics && sceneGraph.physics.gravity)
        ? sceneGraph.physics.gravity
        : [0, -9.8, 0];

    return shots.map((shot) => {
        const velocity = inferBaseVelocity(shot.description);
        const collisionHint = inferCollisionHint(shot.description);
        return {
            shotId: shot.id,
            gravity,
            velocity,
            collisionHint,
            motionField: {
                mode: collisionHint === "none" ? "linear" : "interaction-aware",
                intensity: Number((Math.abs(velocity[0]) + Math.abs(velocity[1])) .toFixed(2))
            }
        };
    });
}

module.exports = {
    buildPhysicsChannels
};
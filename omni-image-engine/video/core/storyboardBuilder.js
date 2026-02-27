function inferTransition(index) {
    if (index === 0) return "cold-open";
    return index % 2 === 0 ? "cut" : "gentle-dissolve";
}

function inferCameraPath(shot) {
    if (shot.camera === "pan") {
        return { type: "pan", from: [-0.1, 0, 0.9], to: [0.1, 0, 0.9], fov: 46 };
    }
    if (shot.camera === "zoom") {
        return { type: "zoom", from: [0, 0, 1.1], to: [0, 0, 0.85], fov: 40 };
    }
    return { type: "static", from: [0, 0, 1], to: [0, 0, 1], fov: 44 };
}

function buildStoryboard(shots, keyframes) {
    return shots.map((shot, index) => ({
        shotId: shot.id,
        durationSec: shot.durationSec,
        description: shot.description,
        transitionIn: inferTransition(index),
        cameraPath: inferCameraPath(shot),
        keyframes: keyframes
            .filter((frame) => frame.shotId === shot.id)
            .map((frame) => ({
                index: frame.index,
                timestampSec: frame.timestampSec,
                filePath: frame.filePath
            }))
    }));
}

module.exports = {
    buildStoryboard
};
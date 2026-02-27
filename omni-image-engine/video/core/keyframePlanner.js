function formatStyleHints(styleHints) {
    if (!Array.isArray(styleHints) || !styleHints.length) return "";
    return `style: ${styleHints.join(", ")}`;
}

function formatReferences(referenceImages) {
    if (!Array.isArray(referenceImages) || !referenceImages.length) return "";
    return `references: ${referenceImages.join(", ")}`;
}

function buildKeyframePrompt(request, shot, positionLabel) {
    const parts = [
        request.prompt,
        `shot: ${shot.description}`,
        `camera: ${shot.camera}`,
        `moment: ${positionLabel}`,
        formatStyleHints(request.styleHints),
        formatReferences(request.referenceImages)
    ].filter(Boolean);
    return parts.join(" | ");
}

function planKeyframes(request, shots) {
    const labels = ["start", "mid", "end"];
    const keyframes = [];

    shots.forEach((shot) => {
        labels.forEach((label, index) => {
            const timestampSec = Number(((shot.durationSec / 2) * index).toFixed(2));
            keyframes.push({
                shotId: shot.id,
                index,
                timestampSec,
                prompt: buildKeyframePrompt(request, shot, label)
            });
        });
    });

    return keyframes;
}

module.exports = {
    planKeyframes
};
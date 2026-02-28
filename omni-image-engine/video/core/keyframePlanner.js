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
        "motion continuity: preserve temporal coherence between adjacent frames",
        formatStyleHints(request.styleHints),
        formatReferences(request.referenceImages)
    ].filter(Boolean);
    return parts.join(" | ");
}

function allocateFramesAcrossShots(shots, targetFrames) {
    const totalDuration = shots.reduce((sum, shot) => sum + Math.max(0.001, Number(shot.durationSec) || 0), 0);
    let remaining = targetFrames;

    return shots.map((shot, index) => {
        if (index === shots.length - 1) {
            return Math.max(1, remaining);
        }

        const weight = (Number(shot.durationSec) || 0) / Math.max(0.001, totalDuration);
        const allocated = Math.max(1, Math.round(targetFrames * weight));
        const count = Math.min(allocated, remaining - (shots.length - (index + 1)));
        remaining -= count;
        return count;
    });
}

function planKeyframes(request, shots) {
    const targetFrames = Math.max(request.minFrames || 12, Math.min(request.maxFrames || 48, request.targetFrames || 12));
    const perShotCounts = allocateFramesAcrossShots(shots, targetFrames);
    const keyframes = [];
    let shotOffsetSec = 0;

    shots.forEach((shot, shotIndex) => {
        const frameCount = perShotCounts[shotIndex] || 1;
        for (let index = 0; index < frameCount; index += 1) {
            const ratio = frameCount === 1 ? 0 : index / (frameCount - 1);
            const timestampSec = Number((shotOffsetSec + shot.durationSec * ratio).toFixed(2));
            const label = `${Math.round(ratio * 100)}%`;
            keyframes.push({
                shotId: shot.id,
                index,
                timestampSec,
                prompt: buildKeyframePrompt(request, shot, label)
            });
        }

        shotOffsetSec += shot.durationSec;
    });

    return keyframes;
}

module.exports = {
    planKeyframes
};
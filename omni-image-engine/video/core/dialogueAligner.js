function estimateVisemeWindows(line, shotDurationSec) {
    const words = String(line.text || "").trim().split(/\s+/).filter(Boolean);
    const windows = [];
    const step = Math.max(0.08, shotDurationSec / Math.max(1, words.length + 2));

    words.forEach((word, index) => {
        const startSec = Number((index * step).toFixed(2));
        const endSec = Number(Math.min(shotDurationSec, startSec + step * 0.8).toFixed(2));
        windows.push({
            token: word,
            startSec,
            endSec,
            viseme: /[aeiou]/i.test(word) ? "open" : "closed"
        });
    });

    return windows;
}

function alignDialogueToShots(dialogue, shots) {
    if (!Array.isArray(dialogue) || !dialogue.length) return [];

    return dialogue.map((line, index) => {
        const shot = shots[Math.min(index, shots.length - 1)];
        const startSec = 0;
        const endSec = Number(Math.min(shot.durationSec, line.durationSec).toFixed(2));

        return {
            lineId: line.id,
            shotId: shot.id,
            speaker: line.speaker,
            emotion: line.emotion,
            text: line.text,
            timing: {
                startSec,
                endSec,
                reactionBeforeSec: Number((Math.min(0.2, shot.durationSec * 0.1)).toFixed(2)),
                reactionAfterSec: Number((Math.min(0.25, shot.durationSec * 0.12)).toFixed(2))
            },
            visemeHints: estimateVisemeWindows(line, shot.durationSec)
        };
    });
}

module.exports = {
    alignDialogueToShots
};
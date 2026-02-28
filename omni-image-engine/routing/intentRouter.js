const VIDEO_KEYWORDS = {
    video: 2.6,
    gif: 2.4,
    animation: 2.3,
    animated: 2.1,
    clip: 2.2,
    loop: 2.1,
    sequence: 1.9,
    frame: 1.6,
    frames: 1.8,
    motion: 2,
    moving: 1.8,
    pan: 1.7,
    tilt: 1.7,
    dolly: 1.8,
    tracking: 1.6,
    cinematic: 1.1,
    transition: 1.6,
    parallax: 1.7,
    timelapse: 2
};

const IMAGE_KEYWORDS = {
    image: 2.4,
    still: 2.2,
    photo: 2,
    photograph: 2,
    portrait: 1.9,
    illustration: 1.9,
    render: 1.8,
    drawing: 1.8,
    wallpaper: 1.6,
    poster: 1.6,
    vector: 1.7,
    icon: 1.5,
    logo: 1.4,
    artwork: 1.7,
    snapshot: 1.6,
    static: 1.8,
    stillness: 1.8
};

const AMBIGUOUS_TERMS = new Set([
    "scene",
    "cinematic",
    "dynamic",
    "dramatic",
    "composition"
]);

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function tokenize(prompt) {
    return String(prompt || "")
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .map((token) => token.trim())
        .filter(Boolean);
}

function scoreTokens(tokens, map) {
    return tokens.reduce((score, token) => score + (map[token] || 0), 0);
}

function collectMatched(tokens, map) {
    const matched = [];
    const seen = new Set();
    tokens.forEach((token) => {
        if (map[token] && !seen.has(token)) {
            seen.add(token);
            matched.push(token);
        }
    });
    return matched;
}

function historyBias(history = {}) {
    const imageCount = Number(history.imageCount) || 0;
    const videoCount = Number(history.videoCount) || 0;
    const total = imageCount + videoCount;

    if (total <= 0) {
        return { image: 0, video: 0 };
    }

    const imageRatio = imageCount / total;
    const videoRatio = videoCount / total;

    return {
        image: clamp((imageRatio - 0.5) * 0.9, -0.35, 0.35),
        video: clamp((videoRatio - 0.5) * 0.9, -0.35, 0.35)
    };
}

function routePromptIntent(prompt, options = {}) {
    const tokens = tokenize(prompt);
    const preferredIntent = String(options.preferredIntent || "auto").toLowerCase();
    const threshold = clamp(Number(options.confidenceThreshold) || 0.75, 0.51, 0.95);
    const bias = historyBias(options.userHistory || {});

    const imageSignal = scoreTokens(tokens, IMAGE_KEYWORDS) + bias.image;
    const videoSignal = scoreTokens(tokens, VIDEO_KEYWORDS) + bias.video;

    const totalSignal = Math.max(0.001, imageSignal + videoSignal);
    const margin = Math.abs(videoSignal - imageSignal) / totalSignal;
    const confidence = clamp(0.5 + margin * 0.5, 0.5, 0.99);

    let intent = "ambiguous";
    if (margin >= 0.2) {
        intent = videoSignal > imageSignal ? "video" : "image";
    }

    const matchedImageTerms = collectMatched(tokens, IMAGE_KEYWORDS);
    const matchedVideoTerms = collectMatched(tokens, VIDEO_KEYWORDS);
    const matchedAmbiguousTerms = tokens.filter((token) => AMBIGUOUS_TERMS.has(token));

    if (intent === "ambiguous" && (preferredIntent === "image" || preferredIntent === "video")) {
        intent = preferredIntent;
    }

    const finalConfidence = intent === "ambiguous" ? confidence * 0.9 : confidence;
    const shouldAskUser = finalConfidence < threshold || (matchedImageTerms.length && matchedVideoTerms.length);

    return {
        intent,
        confidence: Number(finalConfidence.toFixed(3)),
        shouldAskUser,
        threshold,
        signals: {
            image: Number(imageSignal.toFixed(3)),
            video: Number(videoSignal.toFixed(3)),
            margin: Number(margin.toFixed(3))
        },
        matched: {
            image: matchedImageTerms,
            video: matchedVideoTerms,
            ambiguous: [...new Set(matchedAmbiguousTerms)]
        }
    };
}

module.exports = {
    routePromptIntent
};

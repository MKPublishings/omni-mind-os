const path = require("path");
const { generateVideoClip } = require("../core/videoEngine");
const { validateVideoResult } = require("./videoContractValidator");

let imageCounter = 0;

async function mockImageGenerate(prompt, options = {}) {
    imageCounter += 1;
    const safeName = String(prompt).toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 36) || "frame";
    const filename = `mock_frame_${imageCounter}_${safeName}_${options.width || 0}x${options.height || 0}.png`;
    return {
        filePath: path.join(process.cwd(), "omni_image_exports", filename)
    };
}

async function expectReject(label, run, expected) {
    try {
        await run();
        throw new Error(`${label}: expected rejection but succeeded`);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!message.includes(expected)) {
            throw new Error(`${label}: rejected with unexpected message: ${message}`);
        }
        console.log(`✓ ${label}: rejected with guard message`);
    }
}

async function runSuccessCase() {
    const result = await generateVideoClip(
        "A lone explorer walks through a neon ruin at dusk. Wind moves dust in arcs.",
        "balanced",
        {
            format: "mp4",
            maxSizeMB: 2,
            enableEncoding: false,
            styleHints: ["cinematic", "high contrast"],
            dialogue: [
                { speaker: "explorer", text: "We keep moving.", durationSec: 1.1, emotion: "focused" }
            ]
        },
        mockImageGenerate
    );

    validateVideoResult(result);

    if (result.output.type !== "manifest") {
        throw new Error(`expected manifest output in smoke test, got ${result.output.type}`);
    }

    if (result.encoder.used !== false) {
        throw new Error("expected encoder.used=false in smoke test");
    }

    if (!Array.isArray(result.optimization.adaptiveTiers) || result.optimization.adaptiveTiers.length < 3) {
        throw new Error("expected optimization.adaptiveTiers to contain fallback tiers");
    }

    console.log("✓ video success case: valid result contract");
}

async function run() {
    await expectReject(
        "video null prompt",
        () => generateVideoClip(null, "balanced", {}, mockImageGenerate),
        "non-empty prompt string"
    );

    await expectReject(
        "video empty prompt",
        () => generateVideoClip("", "balanced", {}, mockImageGenerate),
        "non-empty prompt string"
    );

    await runSuccessCase();
    console.log("Video engine smoke test passed.");
}

run().catch((error) => {
    console.error("Video engine smoke test failed:", error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});
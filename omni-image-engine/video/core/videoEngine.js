const { normalizeVideoRequest } = require("../contracts");
const { createBudget } = require("./budgetController");
const { parseSceneAndShots } = require("./sceneAndShotParser");
const { planKeyframes } = require("./keyframePlanner");
const { generateKeyframes } = require("./keyframeGenerator");
const { buildPhysicsChannels } = require("./physicsConditioner");
const { buildGlobalContext, buildEntityTracks } = require("./contextTracker");
const { alignDialogueToShots } = require("./dialogueAligner");
const { buildStoryboard } = require("./storyboardBuilder");
const { buildOptimizationPlan } = require("./optimizationPlanner");
const { exportVideoManifest } = require("../io/manifestExporter");
const { maybeEncodeVideo } = require("../io/ffmpegEncoder");

async function generateVideoClip(prompt, mode = "balanced", options = {}, imageGenerateFn) {
    const request = normalizeVideoRequest(prompt, mode, options);
    const budget = createBudget(request);
    const { sceneGraph, shots } = parseSceneAndShots(request, budget);
    const globalContext = buildGlobalContext(request, sceneGraph, budget);
    const entityTracks = buildEntityTracks(sceneGraph, shots);
    const physicsChannels = buildPhysicsChannels(sceneGraph, shots);
    const dialogueTimeline = alignDialogueToShots(request.dialogue, shots);
    const keyframePlan = planKeyframes(request, shots);
    const keyframes = await generateKeyframes(request, budget, keyframePlan, imageGenerateFn);
    const storyboard = buildStoryboard(shots, keyframes);
    const optimization = buildOptimizationPlan(request, budget);

    const payload = {
        mode: request.mode,
        format: request.format,
        budget: {
            maxSizeMB: budget.maxSizeMB,
            width: budget.width,
            height: budget.height,
            fps: budget.fps,
            durationSec: budget.durationSec,
            estimatedSizeMB: budget.estimatedSizeMB
        },
        context: globalContext,
        sceneGraph,
        entityTracks,
        shots,
        physicsChannels,
        dialogueTimeline,
        storyboard,
        optimization,
        keyframes
    };

    const manifestPath = await exportVideoManifest(payload);
    const encoded = await maybeEncodeVideo({ request, budget, keyframes });

    if (encoded.success) {
        return {
            ...payload,
            output: {
                type: request.format,
                filePath: encoded.filePath,
                manifestPath
            },
            encoder: {
                used: true,
                reason: encoded.reason,
                sizeMB: encoded.sizeMB,
                budgetMB: request.maxSizeMB
            }
        };
    }

    return {
        ...payload,
        output: {
            type: "manifest",
            filePath: manifestPath
        },
        encoder: {
            used: false,
            reason: encoded.reason
        }
    };
}

module.exports = {
    generateVideoClip
};
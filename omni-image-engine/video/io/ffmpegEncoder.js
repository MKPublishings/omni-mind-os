const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { formatDateTimeForFilename } = require("../../utils/datetime");
const { resolveFfmpegCommand } = require("./ffmpegResolver");

const OUTPUT_DIR = path.join(process.cwd(), "omni_video_exports");
const ENABLE_VALUES = new Set(["1", "true", "yes", "on"]);

function ensureOutputDir() {
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
}

function runProcess(command, args) {
    return new Promise((resolve, reject) => {
        const proc = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
        let stderr = "";

        proc.stderr.on("data", (chunk) => {
            stderr += String(chunk || "");
        });

        proc.on("error", reject);
        proc.on("close", (code) => {
            if (code === 0) {
                resolve();
                return;
            }
            reject(new Error(stderr.trim() || `${command} exited with code ${code}`));
        });
    });
}

async function hasFfmpeg() {
    const ffmpegCommand = resolveFfmpegCommand();
    try {
        await runProcess(ffmpegCommand, ["-version"]);
        return true;
    } catch (_error) {
        return false;
    }
}

function isEncodingEnabled(options = {}) {
    if (options.enableEncoding === true) return true;
    const envValue = String(process.env.OMNI_VIDEO_ENABLE_ENCODING || "").toLowerCase().trim();
    return ENABLE_VALUES.has(envValue);
}

function buildConcatManifest(keyframes, durationSec) {
    const uniqueFrames = keyframes.filter((frame, index) => index === 0 || frame.filePath !== keyframes[index - 1].filePath);
    const frameDuration = Number((durationSec / Math.max(1, uniqueFrames.length)).toFixed(4));
    const lines = ["ffconcat version 1.0"];

    uniqueFrames.forEach((frame) => {
        const normalizedPath = String(frame.filePath).replace(/\\/g, "/").replace(/'/g, "'\\''");
        lines.push(`file '${normalizedPath}'`);
        lines.push(`duration ${frameDuration}`);
    });

    if (uniqueFrames.length) {
        const tailPath = String(uniqueFrames[uniqueFrames.length - 1].filePath).replace(/\\/g, "/").replace(/'/g, "'\\''");
        lines.push(`file '${tailPath}'`);
    }

    return lines.join("\n");
}

function toMB(byteCount) {
    return Number((byteCount / (1024 * 1024)).toFixed(3));
}

function estimateTargetBitrateKbps(request, budget, scale = 1) {
    const duration = Math.max(0.6, Number(budget.durationSec) || 0.6);
    const safety = request.format === "gif" ? 0.78 : 0.86;
    const base = ((request.maxSizeMB * 8192) / duration) * safety;
    const motionPenalty = 1 + Math.min(0.35, (Number(budget.motionComplexity) || 1) - 1);
    return Math.max(120, Math.floor((base / motionPenalty) * scale));
}

function buildMp4Attempts(request, budget) {
    const baseBitrate = estimateTargetBitrateKbps(request, budget, 1);
    const reducedBitrate = estimateTargetBitrateKbps(request, budget, 0.78);

    return [
        { codec: "libx265", preset: "medium", crf: 30, bitrateKbps: baseBitrate, scale: 1 },
        { codec: "libx265", preset: "fast", crf: 34, bitrateKbps: reducedBitrate, scale: 0.94 },
        { codec: "libx264", preset: "veryfast", crf: 31, bitrateKbps: reducedBitrate, scale: 0.9 }
    ];
}

function buildGifAttempts(request, budget) {
    const highMotion = (Number(budget.motionComplexity) || 1) > 1.2;
    return [
        {
            fps: budget.fps,
            width: budget.width,
            height: budget.height,
            maxColors: highMotion ? 96 : 128
        },
        {
            fps: Math.max(8, budget.fps - 2),
            width: Math.max(320, Math.floor(budget.width * 0.9)),
            height: Math.max(320, Math.floor(budget.height * 0.9)),
            maxColors: 64
        }
    ];
}

async function tryEncodeMp4(ffmpegCommand, baseInputArgs, outputPath, attempt, budget) {
    const scaledWidth = Math.max(320, Math.floor(budget.width * attempt.scale));
    const scaledHeight = Math.max(320, Math.floor(budget.height * attempt.scale));

    await runProcess(ffmpegCommand, [
        ...baseInputArgs,
        "-vf",
        `fps=${budget.fps},scale=${scaledWidth}:${scaledHeight}:flags=lanczos,format=yuv420p`,
        "-an",
        "-c:v",
        attempt.codec,
        "-preset",
        attempt.preset,
        "-crf",
        String(attempt.crf),
        "-b:v",
        `${attempt.bitrateKbps}k`,
        "-maxrate",
        `${Math.max(160, Math.floor(attempt.bitrateKbps * 1.2))}k`,
        "-bufsize",
        `${Math.max(320, Math.floor(attempt.bitrateKbps * 2))}k`,
        "-movflags",
        "+faststart",
        outputPath
    ]);
}

async function tryEncodeGif(ffmpegCommand, baseInputArgs, outputPath, attempt) {
    const gifFilter = `fps=${attempt.fps},scale=${attempt.width}:${attempt.height}:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=${attempt.maxColors}[p];[s1][p]paletteuse=dither=floyd_steinberg`;
    await runProcess(ffmpegCommand, [
        ...baseInputArgs,
        "-vf",
        gifFilter,
        outputPath
    ]);
}

async function encodeWithFfmpeg({ request, budget, keyframes }) {
    const ffmpegCommand = resolveFfmpegCommand();
    ensureOutputDir();
    const timestamp = formatDateTimeForFilename(new Date());
    const concatPath = path.join(OUTPUT_DIR, `omni_video_concat_${timestamp}.txt`);
    const outputPath = path.join(OUTPUT_DIR, `omni_video_${timestamp}.${request.format}`);

    const concatManifest = buildConcatManifest(keyframes, budget.durationSec);
    await fs.promises.writeFile(concatPath, concatManifest, "utf8");

    const baseInputArgs = ["-y", "-f", "concat", "-safe", "0", "-i", concatPath];

    let successReason = "";
    let sizeMB = Number.POSITIVE_INFINITY;

    if (request.format === "gif") {
        const attempts = buildGifAttempts(request, budget);
        for (const attempt of attempts) {
            await fs.promises.unlink(outputPath).catch(() => null);
            await tryEncodeGif(ffmpegCommand, baseInputArgs, outputPath, attempt);

            const stats = await fs.promises.stat(outputPath);
            sizeMB = toMB(stats.size);
            if (sizeMB <= request.maxSizeMB) {
                successReason = `encoded-with-ffmpeg:gif:${attempt.fps}fps:${attempt.maxColors}colors`;
                break;
            }
        }
    } else {
        const attempts = buildMp4Attempts(request, budget);
        for (const attempt of attempts) {
            await fs.promises.unlink(outputPath).catch(() => null);
            try {
                await tryEncodeMp4(ffmpegCommand, baseInputArgs, outputPath, attempt, budget);
            } catch (error) {
                if (String(error?.message || "").toLowerCase().includes("unknown encoder")) {
                    continue;
                }
                throw error;
            }

            const stats = await fs.promises.stat(outputPath);
            sizeMB = toMB(stats.size);
            if (sizeMB <= request.maxSizeMB) {
                successReason = `encoded-with-ffmpeg:mp4:${attempt.codec}:${attempt.bitrateKbps}k`;
                break;
            }
        }
    }

    await fs.promises.unlink(concatPath).catch(() => null);

    if (!Number.isFinite(sizeMB) || sizeMB > request.maxSizeMB) {
        await fs.promises.unlink(outputPath).catch(() => null);
        return {
            success: false,
            reason: `encoded-size-exceeds-budget:${sizeMB}MB>${request.maxSizeMB}MB`
        };
    }

    return {
        success: true,
        filePath: outputPath,
        sizeMB,
        reason: successReason || "encoded-with-ffmpeg"
    };
}

async function maybeEncodeVideo({ request, budget, keyframes }) {
    if (!isEncodingEnabled(request)) {
        return {
            success: false,
            reason: "encoding-disabled"
        };
    }

    const available = await hasFfmpeg();
    if (!available) {
        return {
            success: false,
            reason: "ffmpeg-unavailable"
        };
    }

    try {
        return await encodeWithFfmpeg({ request, budget, keyframes });
    } catch (error) {
        return {
            success: false,
            reason: `ffmpeg-failed:${error.message}`
        };
    }
}

module.exports = {
    maybeEncodeVideo,
    isEncodingEnabled
};
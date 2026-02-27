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

async function encodeWithFfmpeg({ request, budget, keyframes }) {
    const ffmpegCommand = resolveFfmpegCommand();
    ensureOutputDir();
    const timestamp = formatDateTimeForFilename(new Date());
    const concatPath = path.join(OUTPUT_DIR, `omni_video_concat_${timestamp}.txt`);
    const outputPath = path.join(OUTPUT_DIR, `omni_video_${timestamp}.${request.format}`);

    const concatManifest = buildConcatManifest(keyframes, budget.durationSec);
    await fs.promises.writeFile(concatPath, concatManifest, "utf8");

    const baseInputArgs = ["-y", "-f", "concat", "-safe", "0", "-i", concatPath];

    if (request.format === "gif") {
        const gifFilter = `fps=${budget.fps},scale=${budget.width}:${budget.height}:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=96[p];[s1][p]paletteuse=dither=floyd_steinberg`;
        await runProcess(ffmpegCommand, [
            ...baseInputArgs,
            "-vf",
            gifFilter,
            outputPath
        ]);
    } else {
        await runProcess(ffmpegCommand, [
            ...baseInputArgs,
            "-vf",
            `fps=${budget.fps},scale=${budget.width}:${budget.height}:flags=lanczos,format=yuv420p`,
            "-an",
            "-c:v",
            "libx264",
            "-profile:v",
            "baseline",
            "-preset",
            "veryfast",
            "-crf",
            "31",
            "-movflags",
            "+faststart",
            outputPath
        ]);
    }

    const stats = await fs.promises.stat(outputPath);
    const sizeMB = toMB(stats.size);

    await fs.promises.unlink(concatPath).catch(() => null);

    if (sizeMB > request.maxSizeMB) {
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
        reason: "encoded-with-ffmpeg"
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